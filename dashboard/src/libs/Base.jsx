import React from 'react';
import PropTypes from 'prop-types';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import CssBaseline from '@mui/material/CssBaseline';
import useScrollTrigger from '@mui/material/useScrollTrigger';
import Box from '@mui/material/Box';
import Slide from '@mui/material/Slide';
import Link from '@mui/material/Link';

function HideOnScroll(props) {
    const { children, window } = props;
    // Note that you normally won't need to set the window ref as useScrollTrigger
    // will default to window.
    // This is only being set here because the demo is in an iframe.
    const trigger = useScrollTrigger({ target: window ? window() : undefined });

    return (
        <Slide appear={false} direction="down" in={!trigger}>
            {children}
        </Slide>
    );
}

HideOnScroll.propTypes = {
    children: PropTypes.element.isRequired,
    /**
     * Injected by the documentation to work in an iframe.
     * You won't need it on your project.
     */
    window: PropTypes.func,
};

export default function HideAppBar(props) {
    const { children, isLoading, ...rest } = props;
    return (
        <>
            <CssBaseline />
            <HideOnScroll {...rest}>
                <AppBar
                    sx={{
                        backdropFilter: 'blur(4px)',
                        backgroundColor: '#0071adbd',
                    }}
                >
                    <Toolbar>
                        <Typography sx={{ flexGrow: 1 }} variant="h6">
                            🇱🇰 Fuel Availability
                        </Typography>
                    </Toolbar>
                </AppBar>
            </HideOnScroll>
            <Toolbar />
            <Box>{children}</Box>
            <Box color="text.secondary">
                Data source :{' '}
                <Link
                    target="_blank"
                    rel="noopener"
                    href={'https://home.knnect.com:9443/devportal/'}
                >
                    GitHub
                </Link>
                {'    '}
                Source code :{' '}
                <Link
                    target="_blank"
                    rel="noopener"
                    href={'https://github.com/tmkasun/better-fuel-gov.lk'}
                >
                    GitHub
                </Link>
            </Box>
        </>
    );
}
