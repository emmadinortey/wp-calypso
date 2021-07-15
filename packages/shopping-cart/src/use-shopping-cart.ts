/**
 * External dependencies
 */
import { useContext, useReducer, useEffect } from 'react';

/**
 * Internal dependencies
 */
import type { ShoppingCartManager } from './types';
import ShoppingCartContext from './shopping-cart-context';

export default function useShoppingCart(): ShoppingCartManager {
	const managerClient = useContext( ShoppingCartContext );
	if ( ! managerClient ) {
		throw new Error( 'useShoppingCart must be used inside a ShoppingCartProvider' );
	}

	const manager = managerClient.getDefaultManager();

	// Re-render when the cart changes
	const [ , forceUpdate ] = useReducer( () => [], [] );
	useEffect( () => {
		return manager.subscribe( forceUpdate );
	}, [ manager ] );

	return manager;
}
