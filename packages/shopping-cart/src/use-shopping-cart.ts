/**
 * External dependencies
 */
import { useContext, useReducer, useEffect } from 'react';

/**
 * Internal dependencies
 */
import type { ShoppingCartManager } from './types';
import ShoppingCartContext from './shopping-cart-context';
import ShoppingCartOptionsContext from './shopping-cart-options-context';
import useRefetchOnFocus from './use-refetch-on-focus';

export default function useShoppingCart( cartKey?: string | undefined ): ShoppingCartManager {
	const managerClient = useContext( ShoppingCartContext );
	if ( ! managerClient ) {
		throw new Error( 'useShoppingCart must be used inside a ShoppingCartProvider' );
	}

	const { defaultCartKey } = useContext( ShoppingCartOptionsContext ) ?? {};
	const manager = managerClient.forCartKey( cartKey ?? defaultCartKey );

	// Re-render when the cart changes
	const [ , forceUpdate ] = useReducer( () => [], [] );
	useEffect( () => {
		return manager.subscribe( forceUpdate );
	}, [ manager ] );

	useRefetchOnFocus( cartKey );

	return manager;
}
