import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import Box from '@mui/material/Box';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { blinkerAnimation } from './SummaryView';
import Divider from '@mui/material/Divider';
import { useQuery } from 'react-query';
import { API_BASE_PATH } from './consts';
import { CircularProgress } from '@mui/material';

type NotificationsProps = {
    open: boolean;
    handleClose: () => void;
};

export default function Notifications({
    open,
    handleClose,
}: NotificationsProps) {
    const theme = useTheme();
    const fullScreen = useMediaQuery(theme.breakpoints.down('md'));
    const { data, isError, error, isLoading } = useQuery(
        '/errors',
        async () => {
            const response = await fetch(`${API_BASE_PATH}/stats/errors`, {
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                },
            });
            if (!response.ok) {
                throw new Error('Unable to fetch Inverter Stats');
            }
            const data = await response.json();
            return data;
        }
    );
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
                Inverter Errors/Warning
            </DialogTitle>
            <DialogContent>
                <Box display="flex" flexDirection="column">
                    {isLoading && !data ? (
                        <CircularProgress />
                    ) : (
                        Object.entries(data).map(
                            ([key, value]) =>
                                value === '1' && (
                                    <Box
                                        display="flex"
                                        flexDirection="row"
                                        justifyContent="space-between"
                                        alignItems="center"
                                    >
                                        <Box>{key}</Box>
                                        <Box
                                            sx={(theme) => ({
                                                border: 1,
                                                borderRadius: '5px',
                                                mx: 1,
                                                borderColor:
                                                    theme.palette.grey[200],
                                                display: 'flex',
                                                flexGrow: 1,
                                            })}
                                        />
                                        <Box>
                                            <WarningAmberIcon
                                                sx={{
                                                    animation: `${blinkerAnimation} 2s linear infinite`,
                                                }}
                                                color="warning"
                                            />
                                        </Box>
                                    </Box>
                                )
                        )
                    )}
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
