/**
 * External dependencies
 */
import { createContext } from 'react';

/**
 * Internal dependencies
 */
import type { ShoppingCartManagerClient } from './types';

const ShoppingCartContext = createContext< ShoppingCartManagerClient | undefined >( undefined );
export default ShoppingCartContext;
