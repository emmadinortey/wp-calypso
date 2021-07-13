/**
 * External dependencies
 */
import page from 'page';

/**
 * Internal dependencies
 */
import controller from './controller';
import { makeLayout, render as clientRender, setLocaleMiddleware } from 'calypso/controller';
import { getLanguageRouteParam } from 'calypso/lib/i18n-utils';

export default function () {
	const lang = getLanguageRouteParam();

	page(
		[
			`/start/${ lang }`,
			`/start/:flowName/${ lang }`,
			`/start/:flowName/:stepName/${ lang }`,
			`/start/:flowName/:stepName/:stepSectionName/${ lang }`,
		],
		controller.redirectWithoutLocaleIfLoggedIn,
		setLocaleMiddleware(),
		controller.redirectTests,
		controller.saveInitialContext,
		controller.redirectToFlow,
		controller.setSelectedSiteForSignup,
		controller.start,
		controller.importSiteInfoFromQuery,
		makeLayout,
		clientRender
	);
}
