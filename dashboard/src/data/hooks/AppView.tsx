import React, { useContext } from 'react';
import { AppViews } from '../../libs/components/consts';

const appView = React.createContext({
    currentView: AppViews.Grid,
    setView: (v: any) => {},
});

const AppViewsProvider = appView.Provider;

export const useAppView = () => {
    return useContext(appView);
};

export default AppViewsProvider;
