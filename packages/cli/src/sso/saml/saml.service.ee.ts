import type express from 'express';
import * as Db from '@/Db';
import { User } from '@/databases/entities/User';
import { AuthIdentity } from '@/databases/entities/AuthIdentity';
import { jsonParse, LoggerProxy } from 'n8n-workflow';
import { AuthError } from '@/ResponseHelper';
import { getIdentityProviderInstance } from './identityProvider.ee';
import { getServiceProviderInstance } from './serviceProvider.ee';
import type { SamlUserAttributes } from './types/samlUserAttributes';
import type { SamlAttributeMapping } from './types/samlAttributeMapping';
import { isSsoJustInTimeProvisioningEnabled } from '../ssoHelpers';
import type { SamlPreferences } from './types/samlPreferences';
import { SAML_PREFERENCES_DB_KEY } from './constants';

export class SamlService {
	private static instance: SamlService;

	private _attributeMapping: SamlAttributeMapping = {
		email: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
		firstName: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/firstname',
		lastName: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/lastname',
		userPrincipalName: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/upn',
	};

	public get attributeMapping(): SamlAttributeMapping {
		return this._attributeMapping;
	}

	public set attributeMapping(mapping: SamlAttributeMapping) {
		// TODO:SAML: add validation
		this._attributeMapping = mapping;
	}

	private _metadata = '';

	public get metadata(): string {
		return this._metadata;
	}

	public set metadata(metadata: string) {
		this._metadata = metadata;
	}

	static getInstance(): SamlService {
		if (!SamlService.instance) {
			SamlService.instance = new SamlService();
			SamlService.instance.init().catch(() => {
				LoggerProxy.error('Error initializing SAML service');
			});
		}
		return SamlService.instance;
	}

	async init(): Promise<void> {
		await this.loadSamlPreferences();
	}

	getRedirectLoginRequestUrl(): string {
		const loginRequest = getServiceProviderInstance().createLoginRequest(
			getIdentityProviderInstance(),
			'redirect',
		);
		//TODO:SAML: debug logging
		LoggerProxy.debug(loginRequest.context);
		return loginRequest.context;
	}

	async handleSamlLogin(req: express.Request): Promise<
		| {
				authenticatedUser: User | undefined;
				attributes: SamlUserAttributes;
				onboardingRequired: boolean;
		  }
		| undefined
	> {
		const attributes = await this.getAttributesFromLoginResponse(req);
		if (attributes.email) {
			const user = await Db.collections.User.findOne({
				where: { email: attributes.email },
				relations: ['globalRole', 'authIdentities'],
			});
			if (user) {
				// Login path for existing users that are fully set up
				if (
					user.authIdentities.find(
						(e) => e.providerType === 'saml' && e.providerId === attributes.userPrincipalName,
					)
				) {
					return {
						authenticatedUser: user,
						attributes,
						onboardingRequired: false,
					};
				} else {
					// Login path for existing users that are NOT fully set up for SAML
					return {
						authenticatedUser: user,
						attributes,
						onboardingRequired: true,
					};
				}
			} else {
				// New users to be created JIT based on SAML attributes
				if (isSsoJustInTimeProvisioningEnabled()) {
					const newUser = await this.createUserFromSamlAttributes(attributes);
					return {
						authenticatedUser: newUser,
						attributes,
						onboardingRequired: true,
					};
				}
			}
		}
		return undefined;
	}

	async getSamlPreferences(): Promise<SamlPreferences> {
		return {
			mapping: this.attributeMapping,
			metadata: this.metadata,
		};
	}

	async setSamlPreferences(prefs: SamlPreferences): Promise<void> {
		this.attributeMapping = prefs.mapping;
		this.metadata = prefs.metadata;
		await this.saveSamlPreferences();
	}

	async loadSamlPreferences(): Promise<SamlPreferences | undefined> {
		const samlPreferences = await Db.collections.Settings.findOne({
			where: { key: SAML_PREFERENCES_DB_KEY },
		});
		if (samlPreferences) {
			const prefs = jsonParse<SamlPreferences>(samlPreferences.value);
			if (prefs) {
				this.attributeMapping = prefs.mapping;
				this.metadata = prefs.metadata;
			}
			return prefs;
		}
		return;
	}

	async saveSamlPreferences(): Promise<void> {
		const samlPreferences = await Db.collections.Settings.findOne({
			where: { key: SAML_PREFERENCES_DB_KEY },
		});
		if (samlPreferences) {
			samlPreferences.value = JSON.stringify({
				mapping: this.attributeMapping,
				metadata: this.metadata,
			});
			samlPreferences.loadOnStartup = true;
			await Db.collections.Settings.save(samlPreferences);
		} else {
			await Db.collections.Settings.save({
				key: SAML_PREFERENCES_DB_KEY,
				value: JSON.stringify({
					mapping: this.attributeMapping,
					metadata: this.metadata,
				}),
				loadOnStartup: true,
			});
		}
	}

	async createUserFromSamlAttributes(attributes: SamlUserAttributes): Promise<User> {
		const user = new User();
		const authIdentity = new AuthIdentity();
		user.email = attributes.email;
		user.firstName = attributes.firstName;
		user.lastName = attributes.lastName;
		authIdentity.providerId = attributes.userPrincipalName;
		authIdentity.providerType = 'saml';
		authIdentity.user = user;
		const resultAuthIdentity = await Db.collections.AuthIdentity.save(authIdentity);
		if (!resultAuthIdentity) throw new AuthError('Could not create AuthIdentity');
		user.authIdentities = [authIdentity];
		const resultUser = await Db.collections.User.save(user);
		if (!resultUser) throw new AuthError('Could not create User');
		return resultUser;
	}

	async updateUserFromSamlAttributes(attributes: SamlUserAttributes): Promise<User> {
		if (!attributes.email) throw new AuthError('Email is required to update user');
		const user = await Db.collections.User.findOne({
			where: { email: attributes.email },
			relations: ['globalRole', 'authIdentities'],
		});
		if (!user) throw new AuthError('User not found');
		let samlAuthIdentity = user?.authIdentities.find((e) => e.providerType === 'saml');
		if (!samlAuthIdentity) {
			samlAuthIdentity = new AuthIdentity();
			samlAuthIdentity.providerId = attributes.userPrincipalName;
			samlAuthIdentity.providerType = 'saml';
			samlAuthIdentity.user = user;
			user.authIdentities.push(samlAuthIdentity);
		} else {
			samlAuthIdentity.providerId = attributes.userPrincipalName;
		}
		await Db.collections.AuthIdentity.save(samlAuthIdentity);
		user.firstName = attributes.firstName;
		user.lastName = attributes.lastName;
		const resultUser = await Db.collections.User.save(user);
		if (!resultUser) throw new AuthError('Could not create User');
		return resultUser;
	}

	async getAttributesFromLoginResponse(req: express.Request): Promise<SamlUserAttributes> {
		const parsedSamlResponse = await getServiceProviderInstance().parseLoginResponse(
			getIdentityProviderInstance(),
			'post',
			req,
		);

		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
		if (parsedSamlResponse?.extract?.attributes) {
			// TODO:SAML: remove, but keep for manual testing for now
			// LoggerProxy.debug(JSON.stringify(parsedSamlResponse.extract));
			// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
			const attributes = parsedSamlResponse.extract.attributes as { [key: string]: string };
			// TODO:SAML: fetch mapped attributes from parsedSamlResponse.extract.attributes and create or login user
			const email = attributes[this.attributeMapping.email];
			const firstName = attributes[this.attributeMapping.firstName];
			const lastName = attributes[this.attributeMapping.lastName];
			const userPrincipalName = attributes[this.attributeMapping.userPrincipalName];

			if (email) {
				return {
					email,
					firstName,
					lastName,
					userPrincipalName,
				};
			} else {
				// collect missing attributes for more informative error message
				const attributesErrors = [];
				if (!email) attributesErrors.push(this.attributeMapping.email);
				if (!userPrincipalName) attributesErrors.push(this.attributeMapping.userPrincipalName);
				if (!firstName) attributesErrors.push(this.attributeMapping.firstName);
				if (!lastName) attributesErrors.push(this.attributeMapping.lastName);

				throw new AuthError(
					`SAML Authentication failed. ${
						attributesErrors ? 'Missing or invalid attributes: ' + attributesErrors.join(', ') : ''
					}`,
				);
			}
		} else {
			throw new AuthError(
				'SAML Authentication failed. Invalid SAML response (missing attributes).',
			);
		}
	}
}
