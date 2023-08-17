import { Box, Typography } from '@mui/material';
import React from 'react';

interface IErrorProps {
    children: React.ReactNode
}
interface IErrorState {
    hasError: boolean;
    error?: Error;
}
class CommonErrorBoundary extends React.Component<IErrorProps, IErrorState> {
    constructor(props: IErrorProps) {
        super(props);
        this.state = { hasError: false }

    }
    componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
        console.error(error)
    }
    static getDerivedStateFromError(error: Error) {
        return { hasError: true, error }
    }
    render(): React.ReactNode {
        const { children } = this.props;
        const { hasError, error } = this.state;
        return (
            hasError ? <Box sx={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <Box sx={{
                    width: '50%',
                    height: '50%',
                    display: 'flex',
                    border: '1px solid red',
                    borderRadius: '1rem',
                    padding: '1rem',
                    justifyContent: 'flex-start',
                    alignItems: 'center',
                    flexDirection: 'column',
                    rowGap: '1rem'
                }}>
                    <Typography variant='h3'>Error while fetching the inverter data!</Typography>
                    <code>
                        {error?.message}
                    </code>
                </Box>
            </Box> : children
        );
    }
}
export default CommonErrorBoundary