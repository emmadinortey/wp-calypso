/**
 * Internal dependencies
 */
import debugFactory from 'debug';
import type {
	GetCartFunction,
	SetCartFunction,
	ShoppingCartManagerClient,
	ShoppingCartManagerWrapper,
	ShoppingCartManager,
	RequestCart,
	ShoppingCartMiddleware,
	ShoppingCartReducerDispatch,
	ShoppingCartAction,
	ShoppingCartState,
	SubscribeCallback,
	UnsubscribeFunction,
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
	ShoppingCartActionCreators,
	ShoppingCartManagerSubscribe,
} from './types';
import { createCartSyncMiddleware, createCartInitMiddleware } from './sync';
import { getInitialShoppingCartState, shoppingCartReducer } from './use-shopping-cart-reducer';
import { createRequestCartProducts } from './create-request-cart-product';
import { getEmptyResponseCart } from './empty-carts';
import { convertTempResponseCartToResponseCart } from './cart-functions';

const debug = debugFactory( 'shopping-cart:shopping-cart-manager' );

function createManager(
	state: ShoppingCartState,
	lastValidResponseCart: ResponseCart,
	actionCreators: ShoppingCartActionCreators,
	subscribe: ShoppingCartManagerSubscribe
): ShoppingCartManager {
	const { cacheStatus, queuedActions, couponStatus, loadingErrorType, loadingError } = state;
	const isLoading = cacheStatus === 'fresh' || cacheStatus === 'fresh-pending';
	const isPendingUpdate = queuedActions.length > 0 || cacheStatus !== 'valid';
	const loadingErrorForManager = cacheStatus === 'error' ? loadingError : null;

	return {
		subscribe,
		...actionCreators,
		isLoading,
		loadingError: loadingErrorForManager,
		loadingErrorType,
		isPendingUpdate,
		couponStatus,
		responseCart: lastValidResponseCart,
	};
}

function createManagerWrapper(
	getState: () => ShoppingCartState,
	dispatch: ShoppingCartReducerDispatch,
	subscribe: ShoppingCartManagerSubscribe
): ShoppingCartManagerWrapper {
	function fetchInitialCart(): void {
		const { cacheStatus } = getState();
		if ( cacheStatus === 'fresh' ) {
			debug( 'triggering fetch of initial cart' );
			dispatch( { type: 'FETCH_INITIAL_RESPONSE_CART' } );
			dispatch( { type: 'GET_CART_FROM_SERVER' } );
		}
	}

	function prepareInvalidCartForSync(): void {
		const { queuedActions, cacheStatus } = getState();
		if ( queuedActions.length === 0 && cacheStatus === 'invalid' ) {
			debug( 'triggering sync of cart to server' );
			dispatch( { type: 'REQUEST_UPDATED_RESPONSE_CART' } );
			dispatch( { type: 'SYNC_CART_TO_SERVER' } );
		}
	}

	const { responseCart: initialResponseCart } = getState();
	let lastValidResponseCart = convertTempResponseCartToResponseCart( initialResponseCart );
	function updateLastValidResponseCart(): void {
		const { queuedActions, cacheStatus, responseCart: tempResponseCart } = getState();
		if ( queuedActions.length === 0 && cacheStatus === 'valid' ) {
			const responseCart = convertTempResponseCartToResponseCart( tempResponseCart );
			lastValidResponseCart = responseCart;
		}
	}

	let actionPromises: ( ( cart: ResponseCart ) => void )[] = [];
	function resolveActionPromisesIfValid(): void {
		const { queuedActions, cacheStatus, responseCart: tempResponseCart } = getState();
		if ( queuedActions.length === 0 && cacheStatus === 'valid' && actionPromises.length > 0 ) {
			debug( `resolving ${ actionPromises.length } action promises` );
			const responseCart = convertTempResponseCartToResponseCart( tempResponseCart );
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

	function playQueuedActions(): void {
		const { queuedActions, cacheStatus } = getState();
		if ( queuedActions.length > 0 && cacheStatus === 'valid' ) {
			debug( 'cart is loaded; playing queued actions', queuedActions );
			dispatch( { type: 'CLEAR_QUEUED_ACTIONS' } );
			queuedActions.forEach( ( action: ShoppingCartAction ) => {
				dispatch( action );
			} );
			debug( 'cart is loaded; queued actions complete' );
		}
	}

	debug( 'subscribing essential updaters' );
	subscribe( () => {
		debug( 'running essential updaters' );
		const { cacheStatus } = getState();
		debug( 'cache status before updaters is', cacheStatus );
		fetchInitialCart();
		updateLastValidResponseCart();
		resolveActionPromisesIfValid();
		prepareInvalidCartForSync();
		playQueuedActions();
		debug( 'running essential updaters complete' );
	} );

	const removeCoupon: RemoveCouponFromCart = () =>
		dispatchAndWaitForValid( { type: 'REMOVE_COUPON' } );
	const addProductsToCart: AddProductsToCart = ( products ) =>
		dispatchAndWaitForValid( {
			type: 'CART_PRODUCTS_ADD',
			products: createRequestCartProducts( products ),
		} );
	const removeProductFromCart: RemoveProductFromCart = ( uuidToRemove ) =>
		dispatchAndWaitForValid( { type: 'REMOVE_CART_ITEM', uuidToRemove } );
	const replaceProductsInCart: ReplaceProductsInCart = ( products ) =>
		dispatchAndWaitForValid( {
			type: 'CART_PRODUCTS_REPLACE_ALL',
			products: createRequestCartProducts( products ),
		} );
	const replaceProductInCart: ReplaceProductInCart = (
		uuidToReplace: string,
		productPropertiesToChange: Partial< RequestCartProduct >
	) =>
		dispatchAndWaitForValid( {
			type: 'CART_PRODUCT_REPLACE',
			uuidToReplace,
			productPropertiesToChange,
		} );
	const updateLocation: UpdateTaxLocationInCart = ( location ) =>
		dispatchAndWaitForValid( { type: 'SET_LOCATION', location } );
	const applyCoupon: ApplyCouponToCart = ( newCoupon ) =>
		dispatchAndWaitForValid( { type: 'ADD_COUPON', couponToAdd: newCoupon } );
	const reloadFromServer: ReloadCartFromServer = () =>
		dispatchAndWaitForValid( { type: 'CART_RELOAD' } );
	const actionCreators = {
		reloadFromServer,
		applyCoupon,
		updateLocation,
		replaceProductInCart,
		replaceProductsInCart,
		removeProductFromCart,
		addProductsToCart,
		removeCoupon,
	};

	let cachedManager = createManager( getState(), lastValidResponseCart, actionCreators, subscribe );
	let lastState = getState();

	function getManager(): ShoppingCartManager {
		if ( lastState !== getState() ) {
			cachedManager = createManager( getState(), lastValidResponseCart, actionCreators, subscribe );
			lastState = getState();
		}
		return cachedManager;
	}

	return {
		getManager,
	};
}

const emptyCart = getEmptyResponseCart();

const noopManager: ShoppingCartManager = {
	subscribe: () => () => null,
	isLoading: true,
	loadingError: undefined,
	loadingErrorType: undefined,
	isPendingUpdate: true,
	couponStatus: 'fresh',
	addProductsToCart: ( products ) => ( products ? Promise.resolve( emptyCart ) : Promise.reject() ),
	removeProductFromCart: ( uuid ) => ( uuid ? Promise.resolve( emptyCart ) : Promise.reject() ),
	applyCoupon: ( coupon ) => ( coupon ? Promise.resolve( emptyCart ) : Promise.reject() ),
	removeCoupon: () => Promise.resolve( emptyCart ),
	updateLocation: ( location ) => ( location ? Promise.resolve( emptyCart ) : Promise.reject() ),
	replaceProductInCart: () => Promise.resolve( emptyCart ),
	replaceProductsInCart: () => Promise.resolve( emptyCart ),
	reloadFromServer: () => Promise.resolve( emptyCart ),
	responseCart: emptyCart,
};

export function createShoppingCartManagerClient( {
	getCart,
	setCart,
}: {
	getCart: GetCartFunction;
	setCart: SetCartFunction;
} ): ShoppingCartManagerClient {
	const statesByCartKey: Record< string, ShoppingCartState > = {};
	const middlewaresByCartKey: Record< string, ShoppingCartMiddleware[] > = {};
	const managerWrappersByCartKey: Record< string, ShoppingCartManagerWrapper > = {};

	function forCartKey( cartKey: string | undefined ): ShoppingCartManager {
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
			const initializeCartFromServer = createCartInitMiddleware( getServerCart );
			middlewaresByCartKey[ cartKey ] = [ initializeCartFromServer, syncCartToServer ];
		}

		if ( ! managerWrappersByCartKey[ cartKey ] ) {
			let subscribedClients: SubscribeCallback[] = [];
			const subscribe = ( callback: SubscribeCallback ): UnsubscribeFunction => {
				debug( `adding subscriber for cartKey ${ cartKey }` );
				subscribedClients.push( callback );
				return () => {
					debug( `removing subscriber for cartKey ${ cartKey }` );
					subscribedClients = subscribedClients.filter(
						( prevCallback ) => prevCallback !== callback
					);
				};
			};
			const notifySubscribers = () => {
				debug( `notifying ${ subscribedClients.length } subscribers for cartKey ${ cartKey }` );
				subscribedClients.forEach( ( clientCallback ) => clientCallback() );
			};

			const dispatch = ( action: ShoppingCartAction ) => {
				setTimeout( () => {
					statesByCartKey[ cartKey ] = shoppingCartReducer( statesByCartKey[ cartKey ], action );
					notifySubscribers();
				} );
			};

			const dispatchWithMiddleware = ( action: ShoppingCartAction ) => {
				debug( `heard action request for cartKey ${ cartKey }`, action.type );
				setTimeout( () => {
					debug( `dispatching action for cartKey ${ cartKey }`, action.type );
					middlewaresByCartKey[ cartKey ].forEach( ( middlewareFn ) =>
						middlewareFn( action, statesByCartKey[ cartKey ], dispatch )
					);
				} );
				dispatch( action );
			};

			debug( `creating cart manager for "${ cartKey }"` );
			managerWrappersByCartKey[ cartKey ] = createManagerWrapper(
				() => statesByCartKey[ cartKey ],
				dispatchWithMiddleware,
				subscribe
			);
		}

		return managerWrappersByCartKey[ cartKey ].getManager();
	}

	return {
		forCartKey,
		subscribeToCartKey: ( cartKey: string, callback ) =>
			forCartKey( cartKey ).subscribe( callback ),
	};
}
