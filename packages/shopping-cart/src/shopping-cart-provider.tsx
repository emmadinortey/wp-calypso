/**
 * External dependencies
 */
import React from 'react';

/**
 * Internal dependencies
 */
import type { RequestCart, ResponseCart } from './types';
import ShoppingCartContext from './shopping-cart-context';
import { createShoppingCartManagerClient } from './shopping-cart-manager';

export default function ShoppingCartProvider( {
	setCart,
	getCart,
	children,
}: {
	cartKey: string | number | null | undefined;
	setCart: ( cartKey: string, requestCart: RequestCart ) => Promise< ResponseCart >;
	getCart: ( cartKey: string ) => Promise< ResponseCart >;
	children: React.ReactNode;
} ): JSX.Element {
	const cartManagerClient = createShoppingCartManagerClient( {
		getCart,
		setCart,
	} );

	return (
		<ShoppingCartContext.Provider value={ cartManagerClient }>
			{ children }
		</ShoppingCartContext.Provider>
	);
}
