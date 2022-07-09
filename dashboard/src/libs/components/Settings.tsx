import * as React from 'react';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import Box from '@mui/material/Box';
import ChargingMode from './ChargingMode';
import OutputMode from './OutputMode';

type SettingsProps = {
    open: boolean;
    handleClose: () => void;
};

export default function Settings({ open, handleClose }: SettingsProps) {
    const theme = useTheme();
    const fullScreen = useMediaQuery(theme.breakpoints.down('md'));
    return (
        <Dialog
            fullScreen={fullScreen}
            open={open}
            onClose={handleClose}
            aria-labelledby="responsive-dialog-title"
            sx={{
                '& .MuiDialog-container': {
                    backdropFilter: 'brightness(0.5) blur(5px)',
                },
            }}
            fullWidth
        >
            <DialogTitle id="responsive-dialog-title">
                Inverter Settings
            </DialogTitle>
            <DialogContent>
                <Box display="flex" flexDirection="column">
                    <Box
                        display="flex"
                        flexDirection="row"
                        justifyContent="space-between"
                        alignItems="center"
                    >
                        <Box>Charging Priority</Box>
                        <Box>
                            <ChargingMode />
                        </Box>
                    </Box>
                    <Box
                        display="flex"
                        justifyContent="space-between"
                        alignItems="center"
                    >
                        <Box>Output Priority</Box>
                        <Box>
                            <OutputMode />
                        </Box>
                    </Box>
                </Box>
            </DialogContent>
            <DialogActions>
                <Button autoFocus onClick={handleClose}>
                    done
                </Button>
            </DialogActions>
        </Dialog>
    );
}
