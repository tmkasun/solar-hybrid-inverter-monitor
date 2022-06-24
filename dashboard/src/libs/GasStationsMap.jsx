import React, { useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import LinearProgress from '@mui/material/LinearProgress';
import FormControlLabel from '@mui/material/FormControlLabel';
import MarkerClusterGroup from 'react-leaflet-markercluster';

import AreaSelect from './components/AreaSelect';
import useInverterLiveStats from './hooks/useInverterLiveStats';
import MarkerCard from './components/MarkerCard';
import SearchByCities from './components/SearchByCities/SearchByCities';

import './css/map.css';
import 'leaflet/dist/leaflet.css';

const getMarker = (shedType) => {
    const pinClass = 'pin-oneavailable';
    const pinEffectClass = 'pin-oneavailable-effect';

    switch (shedType) {
        case 1:
            return new L.icon({
                iconUrl: 'mapIcons/cepetco.png',
                iconSize: [30, 30], // size of the icon
                className: 'logoGlow',
            });
        case 2:
            return new L.icon({
                iconUrl: 'mapIcons/ioc.png',
                iconSize: [30, 30], // size of the icon
                className: 'logoGlow',
            });
        default:
            return new L.divIcon({
                html: `<div class="${pinClass}"></div> <div class="${pinEffectClass}"></div>`,
            });
    }
};

const searchedLocationMarker = new L.icon({
    iconUrl:
        'https://nishati-us.com/wp-content/uploads/2014/09/red-location-icon-map-png-4.png',

    iconSize: [30, 40], // size of the icon
    iconAnchor: [0, 35], // point of the icon which will correspond to marker's location
    popupAnchor: [25, 0], // point from which the popup should open relative to the iconAnchor
});
// https://opencagedata.com/demo

function ChangeView({ center, zoom }) {
    const map = useMap();
    map.setView(center, zoom);
    return null;
}

const GasStationsMap = () => {
    const [currentLocation, setCurrentLocation] = useState(null);
    const [gasStationsMap, error, isLoading] = useInverterLiveStats();
    const gasStations = useMemo(
        () =>
            gasStationsMap ? Object.entries(gasStationsMap) : gasStationsMap,
        [gasStationsMap]
    );

    const reset = () => {
        setCurrentLocation(null);
    };
    const mapCenter = currentLocation
        ? [currentLocation.coords.latitude, currentLocation.coords.longitude]
        : [7.79, 80.91];
    const { zoom: customZoom = 13 } = currentLocation || {};
    const zoom = currentLocation && customZoom ? customZoom : 8;
    return (
        <Grid
            container
            direction="row"
            justifyContent="flex-end"
            alignItems="flex-start"
        >
            {isLoading && (
                <LinearProgress
                    sx={{
                        width: '100vw',
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        zIndex: 1000000, // TODO: Fix this
                    }}
                />
            )}

            <Grid
                container
                direction="row"
                justifyContent="center"
                xs={12}
                sm={3}
                item
            >
                <Grid
                    container
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                    item
                    xs={12}
                >
                    <Grid xs={12} item>
                        <SearchByCities
                            setCurrentLocation={setCurrentLocation}
                        />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                        <Button style={{ color: '#a20000' }} onClick={reset}>
                            RESET
                        </Button>
                    </Grid>
                    <Grid item xs={12} sm={3}>
                        <Box color="success.main" textAlign="center">
                            <Typography variant="subtitle2">
                                <Box
                                    color="text.secondary"
                                    mr={1}
                                    display="inline"
                                >
                                    Total
                                </Box>
                                {gasStations && gasStations.length}
                            </Typography>
                        </Box>
                    </Grid>
                </Grid>
            </Grid>

            <Grid xs={12} sm={9} item>
                <Box border={0} boxShadow={3}>
                    <MapContainer
                        zoomControl
                        style={{ overflow: 'hidden', height: '90vh' }}
                        center={mapCenter}
                        zoom={zoom}
                        scrollWheelZoom
                    >
                        <ChangeView center={mapCenter} zoom={zoom} />
                        <TileLayer
                            url="https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}"
                            accessToken="pk.eyJ1IjoidG1rYXN1biIsImEiOiJlNmZhOTYwNGJlODcxYWE5YjNmYjYzZmJiM2NlZWM4YiJ9.UT41ORairJ1PQ7woCnCH-A"
                            id="mapbox/streets-v11"
                            tileSize={512}
                            zoomOffset={-1}
                        />
                        <MarkerClusterGroup>
                            {gasStations &&
                                gasStations.map(([shedId, gasStation]) => {
                                    const { p92Data: gasStationP92, shedType } =
                                        gasStation;
                                    const { id, longitude, latitude } =
                                        gasStationP92;
                                    const position = [longitude, latitude];
                                    debugger;
                                    return (
                                        <Marker
                                            key={shedId}
                                            icon={getMarker(shedType)}
                                            position={position}
                                        >
                                            <Popup>
                                                <MarkerCard
                                                    gasStation={gasStationP92}
                                                />
                                            </Popup>
                                        </Marker>
                                    );
                                })}
                        </MarkerClusterGroup>
                        {currentLocation && (
                            <Marker
                                icon={searchedLocationMarker}
                                position={mapCenter}
                            >
                                <Popup>Current location</Popup>
                            </Marker>
                        )}
                    </MapContainer>
                </Box>
            </Grid>
        </Grid>
    );
};

export default GasStationsMap;
