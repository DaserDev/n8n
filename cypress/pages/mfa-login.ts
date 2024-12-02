import { BasePage } from './base';
import { SigninPage } from './signin';
import { WorkflowsPage } from './workflows';
import { N8N_AUTH_COOKIE } from '../constants';

export class MfaLoginPage extends BasePage {
	url = '/mfa';

	getters = {
		form: () => cy.getByTestId('mfa-login-form'),
		mfaCode: () => cy.getByTestId('mfaCode'),
		mfaRecoveryCode: () => cy.getByTestId('mfaRecoveryCode'),
		enterRecoveryCodeButton: () => cy.getByTestId('mfa-enter-recovery-code-button'),
	};

	actions = {
		loginWithMfaToken: (email: string, password: string, mfaCode: string) => {
			const signinPage = new SigninPage();
			const workflowsPage = new WorkflowsPage();

			cy.session(
				[mfaCode],
				() => {
					cy.visit(signinPage.url);

					signinPage.getters.form().within(() => {
						signinPage.getters.email().type(email);
						signinPage.getters.password().type(password);
						signinPage.getters.submit().click();
					});

					this.getters.form().within(() => {
						this.getters.mfaCode().type(mfaCode);
					});

					// we should be redirected to /workflows
					cy.url().should('include', workflowsPage.url);
				},
				{
					validate() {
						cy.getCookie(N8N_AUTH_COOKIE).should('exist');
					},
				},
			);
		},
		loginWithRecoveryCode: (email: string, password: string, recoveryCode: string) => {
			const signinPage = new SigninPage();
			const workflowsPage = new WorkflowsPage();

			cy.session(
				[recoveryCode],
				() => {
					cy.visit(signinPage.url);

					signinPage.getters.form().within(() => {
						signinPage.getters.email().type(email);
						signinPage.getters.password().type(password);
						signinPage.getters.submit().click();
					});

					this.getters.enterRecoveryCodeButton().click();

					this.getters.form().within(() => {
						this.getters.mfaRecoveryCode().type(recoveryCode);
					});

					// we should be redirected to /workflows
					cy.url().should('include', workflowsPage.url);
				},
				{
					validate() {
						cy.getCookie(N8N_AUTH_COOKIE).should('exist');
					},
				},
			);
		},
	};
}
