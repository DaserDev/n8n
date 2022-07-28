/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable import/no-cycle */
import cookieParser from 'cookie-parser';
import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { LoggerProxy as Logger } from 'n8n-workflow';
import passport from 'passport';

import { Db } from '../..';
import * as config from '../../../config';
import { AUTH_COOKIE_NAME } from '../../constants';
import { AuthenticatedRequest } from '../../requests';
import { issueCookie } from '../auth/jwt';
import { JwtPayload, N8nApp } from '../Interfaces';
import {
	isAuthenticatedRequest,
	isAuthExcluded,
	isPostUsersId,
	isUserManagementDisabled,
} from '../UserManagementHelper';
import { authenticationMethods } from './auth';
import { meNamespace } from './me';
import { ownerNamespace } from './owner';
import { passwordResetNamespace } from './passwordReset';
import { usersNamespace } from './users';

import expressSession from 'express-session';
import { generators, Issuer, Strategy as OIDCStrategy } from 'openid-client';

export function addRoutes(this: N8nApp, ignoredEndpoints: string[], restEndpoint: string): void {
	// needed for testing; not adding overhead since it directly returns if req.cookies exists
	this.app.use(cookieParser());

	this.app.use(
		expressSession({
			secret: 'keyboard cat',
			resave: false,
			saveUninitialized: true,
		}),
	);

	const options = {
		jwtFromRequest: (req: Request) => {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
			return (req.cookies?.[AUTH_COOKIE_NAME] as string | undefined) ?? null;
		},
		secretOrKey: config.getEnv('userManagement.jwtSecret'),
	};

	// passport.use(
	// 	new Strategy(options, async function validateCookieContents(jwtPayload: JwtPayload, done) {
	// 		try {
	// 			const user = await resolveJwtContent(jwtPayload);
	// 			return done(null, user);
	// 		} catch (error) {
	// 			Logger.debug('Failed to extract user from JWT payload', { jwtPayload });
	// 			return done(null, false, { message: 'User not found' });
	// 		}
	// 	}),
	// );

	// void Issuer.discover('https://nodejs-sample.criipto.id').then((criiptoIssuer) => {
	// 	const client = new criiptoIssuer.Client({
	// 		client_id: 'urn:criipto:nodejs:demo:1010',
	// 		client_secret: 'j9wYVyD3zXZPMo3LTq/xSU/sMu9/shiFKpTHKfqAutM=',
	// 		redirect_uris: ['http://localhost:5678/rest/auth/callback'],
	// 		post_logout_redirect_uris: ['http://localhost:5678/rest/logout'],
	// 		token_endpoint_auth_method: 'client_secret_post',
	// 	});

	// 	this.app.use(
	// 		expressSesssion({
	// 			secret: 'keyboard cat',
	// 			resave: false,
	// 			saveUninitialized: true,
	// 		}),
	// 	);

	// 	this.app.use(passport.initialize());
	// 	this.app.use(passport.session());

	// 	// handles serialization and deserialization of authenticated user
	// 	passport.serializeUser(function (user, done) {
	// 		console.log(user);
	// 		done(null, user);
	// 	});
	// 	passport.deserializeUser(function (user, done) {
	// 		console.log(user);
	// 		done(null, user);
	// 	});

	// 	passport.use(
	// 		'oidc',
	// 		new OidcStrategy({ client }, (tokenSet, userinfo, done) => {
	// 			console.log('tokenSet', tokenSet);
	// 			console.log('userinfo', userinfo);

	// 			req.session.tokenSet = tokenSet;
	// 			req.session.userinfo = userinfo;

	// 			return done(null, tokenSet.claims());
	// 		}),
	// 	);

	// 	this.app.get(`/${restEndpoint}/auth`, async (req, res, next) => {
	// 		console.log('auth');
	// 		passport.authenticate('oidc', { acr_values: 'urn:grn:authn:fi:all' })(req, res, next);
	// 	});

	// 	this.app.get(`/${restEndpoint}/auth/callback`, (req, res, next) => {
	// 		console.log('auth callback');

	// 		passport.authenticate('oidc', {
	// 			passReqToCallback: true,
	// 			successRedirect: '/workflows',
	// 			failureRedirect: '/workflows',
	// 		})(req, res, next);
	// 	});
	// });

	let opts = {};
	const initOIDC = async () => {
		const googleIssuer = await Issuer.discover('https://accounts.google.com');
		// console.log('Discovered issuer %s %O', googleIssuer.issuer, googleIssuer.metadata);

		/* Authorize Code Flow */
		/* client object */
		const client = new googleIssuer.Client({
			client_id: '974645230259-jmd492nm0hlc0vo62h95f47lqss6efj7.apps.googleusercontent.com',
			client_secret: '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',
			redirect_uris: ['https://bhesseldieck.hooks.n8n.cloud/rest/auth/callback'],
			response_types: ['code'],
			token_endpoint_auth_method: 'client_secret_post',
		});

		/* params object */
		const params = {
			client_id: '974645230259-jmd492nm0hlc0vo62h95f47lqss6efj7.apps.googleusercontent.com',
			response_type: 'code',
			scope: 'openid email profile',
			nonce: generators.nonce(),
			redirect_uri: 'https://bhesseldieck.hooks.n8n.cloud/rest/auth/callback',
		};

		opts.client = client;
		opts.params = params;
		opts.passReqToCallback = true;

		this.app.use(passport.initialize());
		this.app.use(passport.session());

		passport.use(
			'openid',
			new OIDCStrategy({ client }, (tokenset, userinfo, done) => {
				console.log('-----tokenset: ');
				console.log(tokenset);
				console.log('userinfo');
				console.log(userinfo);
				return done(null, tokenset.claims());
			}),
		);
	};
	void initOIDC();

	passport.serializeUser(function (user, done) {
		console.log('serialize', user);
		done(null, user);
	});
	passport.deserializeUser(function (user, done) {
		console.log('deserialize', user);
		done(null, user);
	});

	/* Endpoints */
	this.app.get(`/${restEndpoint}/auth`, (req, res, next) => {
		console.log('auth', req.headers, req.body);
		passport.authenticate('openid', { scope: 'profile email openid' }, (data) => {
			console.log('cb auth', data);
			return data;
		})(req, res, next);
	});

	this.app.get(`/${restEndpoint}/auth/callback`, (req, res, next) => {
		console.log('auth callback', req.headers, req.query);
		passport.authenticate(
			'openid',
			{
				failWithError: true,
				passReqToCallback: true,
				successRedirect: `https://n8n.io`,
				failureRedirect: 'https://github.com',
			},
			(error, user, info) => {
				console.log('cb auth callback', error, user, info);
				return user;
			},
		)(req, res, next);
	});

	this.app.use(async (req: Request, res: Response, next: NextFunction) => {
		if (
			// TODO: refactor me!!!
			// skip authentication for preflight requests
			req.method === 'OPTIONS' ||
			req.url === '/index.html' ||
			req.url === '/favicon.ico' ||
			req.url.startsWith('/css/') ||
			req.url.startsWith('/js/') ||
			req.url.startsWith('/fonts/') ||
			req.url.includes('.svg') ||
			req.url.startsWith(`/${restEndpoint}/settings`) ||
			req.url.startsWith(`/${restEndpoint}/login`) ||
			req.url.startsWith(`/${restEndpoint}/logout`) ||
			req.url.startsWith(`/${restEndpoint}/resolve-signup-token`) ||
			isPostUsersId(req, restEndpoint) ||
			req.url.startsWith(`/${restEndpoint}/forgot-password`) ||
			req.url.startsWith(`/${restEndpoint}/resolve-password-token`) ||
			req.url.startsWith(`/${restEndpoint}/change-password`) ||
			req.url.startsWith(`/${restEndpoint}/oauth2-credential/callback`) ||
			req.url.startsWith(`/${restEndpoint}/oauth1-credential/callback`) ||
			isAuthExcluded(req.url, ignoredEndpoints)
		) {
			return next();
		}

		// skip authentication if user management is disabled
		if (isUserManagementDisabled()) {
			req.user = await Db.collections.User.findOneOrFail(
				{},
				{
					relations: ['globalRole'],
				},
			);
			return next();
		}

		// return passport.authenticate('jwt', { session: false })(req, res, next);
		return passport.authenticate('openid', { scope: 'profile email openid' })(req, res, next);
	});

	this.app.use((req: Request | AuthenticatedRequest, res: Response, next: NextFunction) => {
		// req.user is empty for public routes, so just proceed
		// owner can do anything, so proceed as well
		if (!req.user || (isAuthenticatedRequest(req) && req.user.globalRole.name === 'owner')) {
			next();
			return;
		}
		// Not owner and user exists. We now protect restricted urls.
		const postRestrictedUrls = [`/${this.restEndpoint}/users`, `/${this.restEndpoint}/owner`];
		const getRestrictedUrls = [`/${this.restEndpoint}/users`];
		const trimmedUrl = req.url.endsWith('/') ? req.url.slice(0, -1) : req.url;
		if (
			(req.method === 'POST' && postRestrictedUrls.includes(trimmedUrl)) ||
			(req.method === 'GET' && getRestrictedUrls.includes(trimmedUrl)) ||
			(req.method === 'DELETE' &&
				new RegExp(`/${restEndpoint}/users/[^/]+`, 'gm').test(trimmedUrl)) ||
			(req.method === 'POST' &&
				new RegExp(`/${restEndpoint}/users/[^/]+/reinvite`, 'gm').test(trimmedUrl)) ||
			new RegExp(`/${restEndpoint}/owner/[^/]+`, 'gm').test(trimmedUrl)
		) {
			Logger.verbose('User attempted to access endpoint without authorization', {
				endpoint: `${req.method} ${trimmedUrl}`,
				userId: isAuthenticatedRequest(req) ? req.user.id : 'unknown',
			});
			res.status(403).json({ status: 'error', message: 'Unauthorized' });
			return;
		}

		next();
	});

	// middleware to refresh cookie before it expires
	this.app.use(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
		const cookieAuth = options.jwtFromRequest(req);
		if (cookieAuth && req.user) {
			const cookieContents = jwt.decode(cookieAuth) as JwtPayload & { exp: number };
			if (cookieContents.exp * 1000 - Date.now() < 259200000) {
				// if cookie expires in < 3 days, renew it.
				await issueCookie(res, req.user);
			}
		}
		next();
	});

	authenticationMethods.apply(this);
	ownerNamespace.apply(this);
	meNamespace.apply(this);
	passwordResetNamespace.apply(this);
	usersNamespace.apply(this);
}
