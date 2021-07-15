/**
 * External dependencies
 */
import React from 'react';

/**
 * Internal dependencies
 */
import type { RequestCart, ResponseCart, ShoppingCartManagerOptions } from './types';
import ShoppingCartContext from './shopping-cart-context';
import { createShoppingCartManagerClient } from './shopping-cart-manager';

export default function ShoppingCartProvider( {
	cartKey,
	setCart,
	getCart,
	options,
	children,
}: {
	cartKey: string | number | null | undefined;
	setCart: ( cartKey: string, requestCart: RequestCart ) => Promise< ResponseCart >;
	getCart: ( cartKey: string ) => Promise< ResponseCart >;
	options?: ShoppingCartManagerOptions;
	children: React.ReactNode;
} ): JSX.Element {
	const cartManagerClient = createShoppingCartManagerClient( {
		getCart,
		setCart,
		options,
	} );

	cartManagerClient.setDefaultCartKey( cartKey );

	return (
		<ShoppingCartContext.Provider value={ cartManagerClient }>
			{ children }
		</ShoppingCartContext.Provider>
	);
}
