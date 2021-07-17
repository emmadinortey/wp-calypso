/**
 * External dependencies
 */
import { useContext, useReducer, useEffect } from 'react';
import debugFactory from 'debug';

/**
 * Internal dependencies
 */
import type { ShoppingCartManager } from './types';
import ShoppingCartContext from './shopping-cart-context';
import ShoppingCartOptionsContext from './shopping-cart-options-context';
import useRefetchOnFocus from './use-refetch-on-focus';

const debug = debugFactory( 'shopping-cart:use-shopping-cart' );

export default function useShoppingCart( cartKey?: string | undefined ): ShoppingCartManager {
	const managerClient = useContext( ShoppingCartContext );
	if ( ! managerClient ) {
		throw new Error( 'useShoppingCart must be used inside a ShoppingCartProvider' );
	}

	const { defaultCartKey } = useContext( ShoppingCartOptionsContext ) ?? {};
	const finalCartKey = cartKey ?? defaultCartKey;
	debug( `getting cart manager for cartKey ${ finalCartKey }` );
	const manager = managerClient.forCartKey( finalCartKey );

	// Re-render when the cart changes
	const [ , forceUpdate ] = useReducer( () => [], [] );
	useEffect( () => {
		if ( finalCartKey ) {
			debug( 'subscribing to cartKey', finalCartKey );
			return managerClient.subscribeToCartKey( finalCartKey, () => {
				debug( 'cart manager changed; re-rendering' );
				forceUpdate();
			} );
		}
	}, [ managerClient, finalCartKey ] );

	useRefetchOnFocus( cartKey );

	return manager;
}
