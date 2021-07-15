/**
 * Internal dependencies
 */
import debugFactory from 'debug';
import type {
	GetCartFunction,
	SetCartFunction,
	ShoppingCartManagerOptions,
	ShoppingCartManagerClient,
	ShoppingCartManagerController,
	ShoppingCartManager,
	ShoppingCartManagerArguments,
	RequestCart,
	ShoppingCartMiddleware,
	ShoppingCartReducerManager,
	ShoppingCartReducerDispatch,
	ShoppingCartAction,
	ShoppingCartState,
	SubscribeCallback,
	UnsubscribeFunction,
	TempResponseCart,
	CouponStatus,
	CacheStatus,
	ShoppingCartError,
	DispatchAndWaitForValid,
	AddProductsToCart,
	ReplaceProductsInCart,
	RemoveProductFromCart,
	ReplaceProductInCart,
	UpdateTaxLocationInCart,
	ApplyCouponToCart,
	RemoveCouponFromCart,
	ReloadCartFromServer,
	ResponseCart,
	RequestCartProduct,
} from './types';
import { createCartSyncMiddleware } from './sync';
import { getInitialShoppingCartState, shoppingCartReducer } from './use-shopping-cart-reducer';
import { createRequestCartProducts } from './create-request-cart-product';
import { getEmptyResponseCart } from './empty-carts';
import { convertTempResponseCartToResponseCart } from './cart-functions';

const debug = debugFactory( 'shopping-cart:shopping-cart-manager' );

function createManager(
	state: ShoppingCartState,
	dispatch: DispatchAndWaitForValid,
	lastValidResponseCart: ResponseCart
): ShoppingCartManager {
	const removeCoupon: RemoveCouponFromCart = () => dispatch( { type: 'REMOVE_COUPON' } );
	const addProductsToCart: AddProductsToCart = ( products ) =>
		dispatch( {
			type: 'CART_PRODUCTS_ADD',
			products: createRequestCartProducts( products ),
		} );
	const removeProductFromCart: RemoveProductFromCart = ( uuidToRemove ) =>
		dispatch( { type: 'REMOVE_CART_ITEM', uuidToRemove } );
	const replaceProductsInCart: ReplaceProductsInCart = ( products ) =>
		dispatch( {
			type: 'CART_PRODUCTS_REPLACE_ALL',
			products: createRequestCartProducts( products ),
		} );
	const replaceProductInCart: ReplaceProductInCart = (
		uuidToReplace: string,
		productPropertiesToChange: Partial< RequestCartProduct >
	) =>
		dispatch( {
			type: 'CART_PRODUCT_REPLACE',
			uuidToReplace,
			productPropertiesToChange,
		} );
	const updateLocation: UpdateTaxLocationInCart = ( location ) =>
		dispatch( { type: 'SET_LOCATION', location } );
	const applyCoupon: ApplyCouponToCart = ( newCoupon ) =>
		dispatch( { type: 'ADD_COUPON', couponToAdd: newCoupon } );

	const reloadFromServer: ReloadCartFromServer = () => dispatch( { type: 'CART_RELOAD' } );

	const { cacheStatus, queuedActions, couponStatus, loadingErrorType, loadingError } = state;
	const isLoading = cacheStatus === 'fresh' || cacheStatus === 'fresh-pending';
	const isPendingUpdate = queuedActions.length > 0 || cacheStatus !== 'valid';
	const loadingErrorForManager = cacheStatus === 'error' ? loadingError : null;

	return {
		isLoading,
		loadingError: loadingErrorForManager,
		loadingErrorType,
		isPendingUpdate,
		addProductsToCart,
		removeProductFromCart,
		applyCoupon,
		removeCoupon,
		couponStatus,
		updateLocation,
		replaceProductInCart,
		replaceProductsInCart,
		reloadFromServer,
		responseCart: lastValidResponseCart,
	};
}

function createManagerController(
	getState: () => ShoppingCartState,
	dispatch: ShoppingCartReducerDispatch
): ShoppingCartManagerController {
	const { responseCart: initialResponseCart } = getState();
	let lastValidResponseCart = convertTempResponseCartToResponseCart( initialResponseCart );
	function updateLastValidResponseCart( cart: ResponseCart ): void {
		lastValidResponseCart = cart;
	}

	let actionPromises: ( ( cart: ResponseCart ) => void )[] = [];
	function resolveActionPromisesIfValid(): void {
		const { queuedActions, cacheStatus, responseCart: tempResponseCart } = getState();
		if ( queuedActions.length === 0 && cacheStatus === 'valid' ) {
			const responseCart = convertTempResponseCartToResponseCart( tempResponseCart );
			updateLastValidResponseCart( responseCart );
			actionPromises.forEach( ( callback ) => callback( responseCart ) );
			actionPromises = [];
		}
	}

	function dispatchAndWaitForValid( action: ShoppingCartAction ): Promise< ResponseCart > {
		return new Promise< ResponseCart >( ( resolve ) => {
			dispatch( action );
			actionPromises.push( resolve );
		} );
	}

	let subscribedClients: SubscribeCallback[] = [ resolveActionPromisesIfValid ];
	function subscribe( callback: SubscribeCallback ): UnsubscribeFunction {
		subscribedClients.push( callback );
		return () => {
			subscribedClients = subscribedClients.filter( ( prevCallback ) => prevCallback !== callback );
		};
	}

	return {
		subscribe,
		getManager: () => createManager( getState(), dispatchAndWaitForValid, lastValidResponseCart ),
	};
}

const emptyCart = getEmptyResponseCart();

const noopManager: ShoppingCartManagerController = {
	subscribe: () => () => null,
	getManager: () => ( {
		isLoading: true,
		loadingError: undefined,
		loadingErrorType: undefined,
		isPendingUpdate: true,
		couponStatus: 'fresh',
		addProductsToCart: ( products ) =>
			products ? Promise.resolve( emptyCart ) : Promise.reject(),
		removeProductFromCart: ( uuid ) => ( uuid ? Promise.resolve( emptyCart ) : Promise.reject() ),
		applyCoupon: ( coupon ) => ( coupon ? Promise.resolve( emptyCart ) : Promise.reject() ),
		removeCoupon: () => Promise.resolve( emptyCart ),
		updateLocation: ( location ) => ( location ? Promise.resolve( emptyCart ) : Promise.reject() ),
		replaceProductInCart: () => Promise.resolve( emptyCart ),
		replaceProductsInCart: () => Promise.resolve( emptyCart ),
		reloadFromServer: () => Promise.resolve( emptyCart ),
		responseCart: emptyCart,
	} ),
};

export function createShoppingCartManagerClient( {
	getCart,
	setCart,
	options,
}: {
	getCart: GetCartFunction;
	setCart: SetCartFunction;
	options?: ShoppingCartManagerOptions;
} ): ShoppingCartManagerClient {
	const statesByCartKey: Record< string, ShoppingCartState > = {};
	const middlewaresByCartKey: Record< string, ShoppingCartMiddleware[] > = {};

	function getManagerForKey( cartKey: string | undefined ): ShoppingCartManagerController {
		if ( ! cartKey ) {
			return noopManager;
		}

		if ( ! statesByCartKey[ cartKey ] ) {
			statesByCartKey[ cartKey ] = getInitialShoppingCartState();
		}

		const setServerCart = ( cartParam: RequestCart ) => setCart( String( cartKey ), cartParam );
		const getServerCart = () => getCart( String( cartKey ) );
		if ( ! middlewaresByCartKey[ cartKey ] ) {
			const syncCartToServer = createCartSyncMiddleware( setServerCart );
			middlewaresByCartKey[ cartKey ] = [ syncCartToServer ];
		}

		const dispatch = ( action: ShoppingCartAction ) =>
			( statesByCartKey[ cartKey ] = shoppingCartReducer( statesByCartKey[ cartKey ], action ) );

		const dispatchWithMiddleware = ( action: ShoppingCartAction ) => {
			middlewaresByCartKey[ cartKey ].forEach( ( middlewareFn ) =>
				middlewareFn( action, statesByCartKey[ cartKey ], dispatch )
			);
			dispatch( action );
		};

		return createManagerController( () => statesByCartKey[ cartKey ], dispatchWithMiddleware );
	}

	return {
		getManagerForKey,
		setDefaultCartKey,
		getDefaultManager,
	};
}
