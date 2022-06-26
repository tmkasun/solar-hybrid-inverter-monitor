import * as React from 'react';
import FormatAlignLeftIcon from '@mui/icons-material/FormatAlignLeft';
import FormatAlignCenterIcon from '@mui/icons-material/FormatAlignCenter';
import FormatAlignRightIcon from '@mui/icons-material/FormatAlignRight';
import FormatAlignJustifyIcon from '@mui/icons-material/FormatAlignJustify';
import Box from '@mui/material/Box';
import GridViewIcon from '@mui/icons-material/GridView';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import { useAppView } from '../../data/hooks/AppView';
import { AppViews } from './consts';

export default function DiagramVsGauges() {
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

    return (
        <Box
            sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                mr: 3,
                // TODO Replace with Stack
                '& > :not(style) + :not(style)': { mt: 2 },
            }}
        >
            <ToggleButtonGroup
                sx={{
                    backgroundColor: 'azure',
                }}
                size="small"
                {...control}
            >
                <ToggleButton
                    size="small"
                    value={AppViews.Diagram}
                    key={AppViews.Diagram}
                >
                    <AccountTreeIcon />
                </ToggleButton>
                <ToggleButton
                    size="small"
                    value={AppViews.Grid}
                    key={AppViews.Grid}
                >
                    <GridViewIcon />
                </ToggleButton>
            </ToggleButtonGroup>
        </Box>
    );
}
