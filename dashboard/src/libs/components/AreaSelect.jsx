import React, { useState } from 'react';
import NavigationIcon from '@mui/icons-material/Navigation';
import IconButton from '@mui/material/IconButton';
import { green } from '@mui/material/colors';
import CircularProgress from '@mui/material/CircularProgress';
import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';

import PlaceSelector from './PlaceSelector'

export default function AreaSelect(props) {
    const { onLocationChange } = props;
    const [locationStatus, setLocationStatus] = useState(null);
    const [isLocating, setIsLocating] = useState(null);
    const onSelectedLocationChangeHandler = (newLocation) => {
        if (newLocation) {
            const { lat, lng } = newLocation.geometry
            onLocationChange({ coords: { latitude: lat, longitude: lng } })
        }
    }
    const getLocationHandler = () => {
        setIsLocating(true)
        navigator.geolocation.getCurrentPosition(async (position) => {
            onLocationChange(position);
            setLocationStatus(null)
            setIsLocating(false)
            // const { latitude, longitude } = position.coords;
            // const response = await fetch(`https://api.opencagedata.com/geocode/v1/json?q=${latitude}+${longitude}&key=47a4473508fc49518ad05cb0d84f94b8`)
            // const geoData = await response.json()
            // const bestMatch = geoData.results[0];
            // setInputValue(bestMatch.components.town || bestMatch.formatted)
        },
            () => {
                setLocationStatus('Unable to retrieve your location');
                setIsLocating(false)
            });
    }
    return (
        <Box width={1} ml={4} justifyContent='center' alignItems='center' display='flex'>
            <PlaceSelector onValueChange={onSelectedLocationChangeHandler} />
            <Box sx={(theme) => ({
                margin: theme.spacing(1),
                position: 'relative',
            })}>
                <Tooltip title='Locate me'>
                    <IconButton color="primary" onClick={getLocationHandler} aria-label="delete">
                        <NavigationIcon />
                    </IconButton>
                </Tooltip>
                {isLocating && <CircularProgress size={35}
                    sx={{
                        color: green[500],
                        position: 'absolute',
                        top: -1,
                        left: -1,
                        zIndex: 1,
                    }}
                />}
            </Box>
            {isLocating === false && locationStatus && <Box display='block'>
                {locationStatus}
            </Box>}
        </Box>
    );
}