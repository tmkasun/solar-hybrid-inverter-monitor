import * as React from 'react';
import Box from '@mui/material/Box';
import { useAppView } from '../../data/hooks/AppView';
import Stack from '@mui/material/Stack';
import IconButton from '@mui/material/IconButton';
import SettingsIcon from '@mui/icons-material/Settings';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import Settings from './Settings';

export default function ErrorsAndSettings() {
    const { currentView, setView } = useAppView();
    const handleChange = (
        event: React.MouseEvent<HTMLElement>,
        newView: string
    ) => {
        if (newView) {
            setView(newView);
        }
    };
    const control = {
        value: currentView,
        onChange: handleChange,
        exclusive: true,
    };
    const [openSettings, setOpenSettings] = React.useState(false);

    return (
        <Box>
            <Stack direction="row" spacing={1}>
                <IconButton
                    onClick={() => setOpenSettings(true)}
                    sx={{ background: 'white' }}
                    aria-label="settings"
                >
                    <SettingsIcon />
                </IconButton>
                <IconButton
                    sx={{ background: 'white' }}
                    aria-label="notifications"
                >
                    <NotificationsActiveIcon />
                </IconButton>
            </Stack>
            <Settings
                handleClose={() => setOpenSettings(false)}
                open={openSettings}
            />
        </Box>
    );
}
