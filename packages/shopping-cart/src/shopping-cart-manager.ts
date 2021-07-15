/**
 * Internal dependencies
 */
import debugFactory from 'debug';
import type {
	GetCartFunction,
	SetCartFunction,
	ShoppingCartManagerOptions,
	ShoppingCartManagerClient,
	ShoppingCartManager,
	ShoppingCartManagerArguments,
	RequestCart,
	ShoppingCartMiddleware,
	ShoppingCartReducerManager,
	ShoppingCartAction,
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

const debug = debugFactory( 'shopping-cart:shopping-cart-manager' );

function createShoppingCartReducer(
	middlewares: ShoppingCartMiddleware[]
): ShoppingCartReducerManager {
	let state = getInitialShoppingCartState();
	const dispatch = ( action: ShoppingCartAction ) =>
		( state = shoppingCartReducer( state, action ) );

	const dispatchWithMiddleware = ( action: ShoppingCartAction ) => {
		// We want to defer the middleware actions just like the dispatcher is deferred.
		setTimeout( () => {
			middlewares.forEach( ( middlewareFn ) => middlewareFn( action, state, dispatch ) );
		} );
		dispatch( action );
	};

	return {
		dispatch: dispatchWithMiddleware,
		getState: () => state,
	};
}

function createManager( {
	cartKey,
	getCart,
	setCart,
	options,
}: ShoppingCartManagerArguments ): ShoppingCartManager {
	const setServerCart = ( cartParam: RequestCart ) => setCart( String( cartKey ), cartParam );
	const getServerCart = () => getCart( String( cartKey ) );
	const syncCartToServer = createCartSyncMiddleware( setServerCart );
	const cartMiddleware = [ syncCartToServer ];
	const { getState, dispatch } = createShoppingCartReducer( cartMiddleware );

	function generateManager() {
		const hookState = getState();
		const responseCart: TempResponseCart = hookState.responseCart;
		const couponStatus: CouponStatus = hookState.couponStatus;
		const cacheStatus: CacheStatus = hookState.cacheStatus;
		const loadingError: string | undefined = hookState.loadingError;
		const loadingErrorType: ShoppingCartError | undefined = hookState.loadingErrorType;

		const cartValidCallbacks = [];

		const dispatchAndWaitForValid: DispatchAndWaitForValid = ( action ) => {
			debug( 'recevied action', action );
			return new Promise< ResponseCart >( ( resolve ) => {
				dispatch( action );
				cartValidCallbacks.push( resolve );
			} );
		};

		const addProductsToCart: AddProductsToCart = ( products ) =>
			dispatchAndWaitForValid( {
				type: 'CART_PRODUCTS_ADD',
				products: createRequestCartProducts( products ),
			} );

		const replaceProductsInCart: ReplaceProductsInCart = ( products ) =>
			dispatchAndWaitForValid( {
				type: 'CART_PRODUCTS_REPLACE_ALL',
				products: createRequestCartProducts( products ),
			} );

		const removeProductFromCart: RemoveProductFromCart = ( uuidToRemove ) =>
			dispatchAndWaitForValid( { type: 'REMOVE_CART_ITEM', uuidToRemove } );

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

		const removeCoupon: RemoveCouponFromCart = () =>
			dispatchAndWaitForValid( { type: 'REMOVE_COUPON' } );

		const reloadFromServer: ReloadCartFromServer = () =>
			dispatchAndWaitForValid( { type: 'CART_RELOAD' } );

		const isLoading = cacheStatus === 'fresh' || cacheStatus === 'fresh-pending' || ! cartKey;
		const loadingErrorForManager = cacheStatus === 'error' ? loadingError : null;
		const isPendingUpdate =
			hookState.queuedActions.length > 0 || cacheStatus !== 'valid' || ! cartKey;

		const responseCartWithoutTempProducts = useMemo(
			() => convertTempResponseCartToResponseCart( responseCart ),
			[ responseCart ]
		);
		const lastValidResponseCart = useRef< ResponseCart >( responseCartWithoutTempProducts );
		if ( cacheStatus === 'valid' ) {
			lastValidResponseCart.current = responseCartWithoutTempProducts;
		}

		// Refetch when the window is refocused
		useRefetchOnFocus(
			options ?? {},
			cacheStatus,
			responseCartWithoutTempProducts,
			reloadFromServer
		);

		useEffect( () => {
			if ( cartValidCallbacks.current.length === 0 ) {
				return;
			}
			debug( `cacheStatus changed to ${ cacheStatus } and cartValidCallbacks exist` );
			if ( hookState.queuedActions.length === 0 && cacheStatus === 'valid' ) {
				debug( 'calling cartValidCallbacks' );
				cartValidCallbacks.current.forEach( ( callback ) =>
					callback( lastValidResponseCart.current )
				);
				cartValidCallbacks.current = [];
			}
		}, [ hookState.queuedActions, cacheStatus ] );

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
			responseCart: lastValidResponseCart.current,
		};
	}
}

export function createShoppingCartManagerClient( {
	getCart,
	setCart,
	options,
}: {
	getCart: GetCartFunction;
	setCart: SetCartFunction;
	options?: ShoppingCartManagerOptions;
} ): ShoppingCartManagerClient {
	const managers: Record< string, ShoppingCartManager > = {};

	function getManagerForKey( cartKey: string ): ShoppingCartManager {
		if ( ! managers[ cartKey ] ) {
			const manager = createManager( { cartKey, getCart, setCart, options } );
			managers[ cartKey ] = manager;
		}
		return managers[ cartKey ];
	}

	return {
		getManagerForKey,
		setDefaultCartKey,
		getDefaultManager,
	};
}
