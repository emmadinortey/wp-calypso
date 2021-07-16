/**
 * External dependencies
 */
import { createContext } from 'react';

/**
 * Internal dependencies
 */
import type { ShoppingCartManagerOptions } from './types';

const ShoppingCartOptionsContext = createContext< ShoppingCartManagerOptions | undefined >(
	undefined
);
export default ShoppingCartOptionsContext;
