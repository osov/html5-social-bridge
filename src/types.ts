export type CbResultVal = (success: boolean) => void;
export type CbResultData = (status: boolean, data?: any) => void;

export enum INTERSTITIAL_STATE {
    LOADING,
    OPENED,
    CLOSED,
    FAILED
}

export enum REWARDED_STATE {
    LOADING,
    OPENED,
    CLOSED,
    FAILED,
    REWARDED
}

export enum BANNER_STATE {
    LOADING,
    SHOWN,
    HIDDEN,
    FAILED
}


export interface LeaderboardItem {
    id: string,
    score: number,
    rank: number,
    name: string,
    photos: string[],
    extraData?: string,
    isUser: boolean
}


export type CbLeaderboardList = (result: boolean, list: LeaderboardItem[]) => void;
export type CbVisibleState = (visible: boolean) => void;
export type CbInterstitialState = (state: INTERSTITIAL_STATE) => void;
export type CbRewardedState = (state: REWARDED_STATE) => void;
export type CbBannerState = (state: BANNER_STATE) => void;