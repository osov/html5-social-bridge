// GamePush SDK TypeScript Definitions

export interface GamePushPlayer {
    /** Player's identifier within GamePush service */
    id: number;
    /** Player's identifier on the platform (Pikabu, VK, Yandex, etc.) */
    credentials: string;
    /** Player's secret code for authorization */
    secretCode: string;
    /** Player's name */
    name: string;
    /** Player's avatar URL */
    avatar: string;
    /** Player's score */
    score: number;
    /** Is player logged in */
    isLoggedIn: boolean;
    /** Is player active (not banned) */
    active: boolean;
    /** Is player removed */
    removed: boolean;
    /** Is test account */
    test: boolean;

    /** Promise that resolves when player data is ready */
    ready: Promise<void>;

    /** Get player field value */
    get(key: string): any;

    /** Set player field value */
    set(key: string, value: any): void;

    /** Sync player data with cloud */
    sync(options?: { storage?: 'preferred' | 'cloud' | 'platform' | 'local' }): Promise<void>;
}

export interface GamePushAds {
    /** Is fullscreen (interstitial) ads available */
    isFullscreenAvailable: boolean;
    /** Is rewarded video available */
    isRewardedAvailable: boolean;
    /** Is sticky banner available */
    isStickyAvailable: boolean;
    /** Is adblock enabled */
    isAdblockEnabled: boolean;

    /** Show fullscreen interstitial ad */
    showFullscreen(options?: { showCountdownOverlay?: boolean }): Promise<boolean>;

    /** Show rewarded video ad */
    showRewardedVideo(): Promise<boolean>;

    /** Show preloader ad */
    showPreloader(): Promise<boolean>;

    /** Show sticky banner */
    showSticky(): void;

    /** Refresh sticky banner */
    refreshSticky(): void;

    /** Close sticky banner */
    closeSticky(): void;

    /** Subscribe to ads events */
    on(event: 'start' | 'close' | 'rewarded:start' | 'rewarded:reward' | 'rewarded:close' | 'fullscreen:start' | 'fullscreen:close' | 'sticky:start' | 'sticky:close' | 'sticky:refresh' | 'sticky:render', callback: (success?: boolean) => void): void;
}

export interface GamePushProduct {
    /** Product ID */
    id: number;
    /** Product tag */
    tag: string;
    /** Product name */
    name: string;
    /** Product description */
    description: string;
    /** Product icon URL */
    icon: string;
    /** Product icon small URL */
    iconSmall: string;
    /** Product price */
    price: number;
    /** Currency code */
    currency: string;
    /** Currency symbol */
    currencySymbol: string;
    /** Is subscription */
    isSubscription: boolean;
    /** Subscription period in days */
    period: number;
    /** Trial period in days */
    trialPeriod: number;
}

export interface GamePushPurchase {
    /** Product ID */
    productId: number;
    /** Purchase payload */
    payload: string;
    /** Creation timestamp */
    createdAt: string;
    /** Expiration timestamp (for subscriptions) */
    expiredAt: string;
    /** Is gift */
    gift: boolean;
    /** Is subscribed */
    subscribed: boolean;
}

export interface GamePushPurchaseResult {
    /** Purchased product */
    product: GamePushProduct;
    /** Purchase info */
    purchase: GamePushPurchase;
}

export interface GamePushPayments {
    /** Is payments available on this platform */
    isAvailable: boolean;
    /** List of products */
    products: GamePushProduct[];
    /** List of player's purchases */
    purchases: GamePushPurchase[];

    /** Fetch products and purchases from server */
    fetchProducts(): Promise<void>;

    /** Purchase a product */
    purchase(params: { id?: number; tag?: string }): Promise<GamePushPurchaseResult>;

    /** Consume a purchase (for consumable products) */
    consume(params: { id?: number; tag?: string }): Promise<GamePushPurchaseResult>;

    /** Check if player has a purchase */
    has(tagOrId: string | number): boolean;

    /** Subscribe to payment events */
    on(event: 'purchase' | 'error:purchase' | 'consume' | 'error:consume', callback: (result: GamePushPurchaseResult | GamePushPaymentError) => void): void;
}

export interface GamePushPaymentError {
    /** Error code */
    code: 'player_not_found' | 'empty_id_or_tag' | 'product_not_found' | 'purchases_not_alloved_on_platform' | undefined;
    /** Error message */
    message: string;
}

export interface GamePushPlatform {
    /** Platform type (YANDEX, VK, OK, PIKABU, etc.) */
    type: string;
    /** Has integrated authentication */
    hasIntegratedAuth: boolean;
}

export interface GamePushSocials {
    /** Check if native share is supported */
    isSupportsNativeShare: boolean;

    /** Share game */
    share(params?: { text?: string; url?: string; image?: string }): Promise<void>;
}

export interface GamePush {
    /** Player manager */
    player: GamePushPlayer;
    /** Ads manager */
    ads: GamePushAds;
    /** Payments manager */
    payments: GamePushPayments;
    /** Platform info */
    platform: GamePushPlatform;
    /** Socials manager */
    socials: GamePushSocials;
    /** Current language (ISO 639-1) */
    language: string;

    /** Call when game is fully loaded and ready */
    gameStart(): Promise<void>;
}
