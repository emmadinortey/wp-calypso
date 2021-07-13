/**
 * External dependencies
 */
import React from 'react';

/**
 * Internal dependencies
 */
import { getCurrentUser } from 'calypso/state/current-user/selectors';
import { setSection } from 'calypso/state/ui/actions';
import { setLocale } from 'calypso/state/ui/language/actions';
import { getLanguage, isTranslatedIncompletely } from 'calypso/lib/i18n-utils';

const noop = () => {};

export function makeLayoutMiddleware( LayoutComponent ) {
	return ( context, next ) => {
		const { store, section, pathname, query, primary, secondary } = context;

		// On server, only render LoggedOutLayout when logged-out.
		if ( ! context.isServerSide || ! getCurrentUser( context.store.getState() ) ) {
			context.layout = (
				<LayoutComponent
					store={ store }
					currentSection={ section }
					currentRoute={ pathname }
					currentQuery={ query }
					primary={ primary }
					secondary={ secondary }
					redirectUri={ context.originalUrl }
				/>
			);
		}
		next();
	};
}

export function setSectionMiddleware( section ) {
	return ( context, next = noop ) => {
		// save the section in context
		context.section = section;

		// save the section to Redux, too (poised to become legacy)
		context.store.dispatch( setSection( section ) );
		next();
	};
}

function browserLocaleSuggestion() {
	if ( typeof window === 'object' && 'languages' in window.navigator ) {
		for ( const langSlug of window.navigator.languages ) {
			const language = getLanguage( langSlug.toLowerCase() );
			if ( language ) {
				return language.langSlug;
			}
		}
	}

	return null;
}

export const setLocaleMiddleware = ( param = 'lang' ) => ( context, next ) => {
	const paramsLocale = context.params[ param ];
	if ( paramsLocale ) {
		const language = getLanguage( paramsLocale );
		if ( language.parentLangSlug ) {
			context.lang = language.parentLangSlug;
			context.langVariant = language.langSlug;
		} else {
			context.lang = language.langSlug;
			context.langVariant = null;
		}
	} else {
		const currentUser = getCurrentUser( context.store.getState() );
		if (
			currentUser &&
			currentUser.localeSlug &&
			! (
				currentUser.use_fallback_for_incomplete_languages &&
				isTranslatedIncompletely( currentUser.localeSlug )
			)
		) {
			context.lang = currentUser.localeSlug;
			context.langVariant = currentUser.localeVariant;
		} else {
			const browserLang = browserLocaleSuggestion();
			if ( browserLang ) {
				context.lang = browserLang;
				context.langVariant = null;
			}
		}
	}

	context.store.dispatch( setLocale( context.lang, context.langVariant ) );
	next();
};

/**
 * Composes multiple handlers into one.
 *
 * @param { ...( context, next ) => void } handlers - A list of route handlers to compose
 * @returns  { ( context, next ) => void } - A new route handler that executes the handlers in succession
 */
export function composeHandlers( ...handlers ) {
	return ( context, next ) => {
		const it = handlers.values();
		function handleNext() {
			const nextHandler = it.next().value;
			if ( ! nextHandler ) {
				next();
			} else {
				nextHandler( context, handleNext );
			}
		}
		handleNext();
	};
}
