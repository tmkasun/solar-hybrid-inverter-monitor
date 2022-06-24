import * as React from 'react';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import { Alert, AlertTitle } from '@mui/material';

export interface PageErrorProps {
    open: boolean;
    error: any;
}

function PageError(props: PageErrorProps) {
    const { error, open } = props;
    return (
        <Dialog
            sx={{
                '&.MuiDialog-root': {
                    backdropFilter: 'blur(5px) opacity(1)',
                },
            }}
            open={open}
        >
            <Alert severity="error">
                <AlertTitle>Error</AlertTitle>
                {error && error?.message} —{' '}
                <Button onClick={() => window.location.reload()}>REFRESH</Button>
            </Alert>
        </Dialog>
    );
}

export default PageError;
