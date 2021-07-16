/**
 * External dependencies
 */
import React from 'react';

/**
 * Internal dependencies
 */
import type { RequestCart, ResponseCart, ShoppingCartManagerOptions } from './types';
import ShoppingCartContext from './shopping-cart-context';
import ShoppingCartOptionsContext from './shopping-cart-options-context';
import { createShoppingCartManagerClient } from './shopping-cart-manager';

export default function ShoppingCartProvider( {
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
	} );

	return (
		<ShoppingCartOptionsContext.Provider value={ options }>
			<ShoppingCartContext.Provider value={ cartManagerClient }>
				{ children }
			</ShoppingCartContext.Provider>
		</ShoppingCartOptionsContext.Provider>
	);
}
