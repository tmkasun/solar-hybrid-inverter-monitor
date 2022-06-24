import React, { useEffect } from 'react';
import Box from '@mui/material/Box';
import CardActions from '@mui/material/CardActions';
import Checkbox from '@mui/material/Checkbox';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import Skeleton from '@mui/material/Skeleton';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import inComingLoad from './inComing.ico';
//https://www.google.com/maps/dir/?api=1&travelmode=driving&layer=traffic&destination=[YOUR_LAT],[YOUR_LNG]
// https://www.vaccines.gov/search/
import Typography from '@mui/material/Typography';
import { fetchFuelDetails, API_BASE } from '../../data/hooks/fuelData';

import { useQuery } from 'react-query';
import {
    getCityCode,
    getDistrictCode,
    getProvinceCode,
} from '../utils/geographyMap';
import { styled } from '@mui/material';

import dayjs from 'dayjs';
var relativeTime = require('dayjs/plugin/relativeTime');
dayjs.extend(relativeTime, { rounding: Math.floor });

/*

[
    {
        "key": "4",
        "groupOption": false,
        "data": {
            "key": "4",
            "value": "4",
            "children": "Central"
        },
        "label": "Central",
        "value": "4"
    },
    {
        "key": "8",
        "groupOption": false,
        "data": {
            "key": "8",
            "value": "8",
            "children": "Eastern"
        },
        "label": "Eastern",
        "value": "8"
    },
    {
        "key": "6",
        "groupOption": false,
        "data": {
            "key": "6",
            "value": "6",
            "children": "Northern"
        },
        "label": "Northern",
        "value": "6"
    },
    {
        "key": "7",
        "groupOption": false,
        "data": {
            "key": "7",
            "value": "7",
            "children": "North Central"
        },
        "label": "North Central",
        "value": "7"
    },
    {
        "key": "3",
        "groupOption": false,
        "data": {
            "key": "3",
            "value": "3",
            "children": "North Western"
        },
        "label": "North Western",
        "value": "3"
    },
    {
        "key": "5",
        "groupOption": false,
        "data": {
            "key": "5",
            "value": "5",
            "children": "Sabaragamuwa"
        },
        "label": "Sabaragamuwa",
        "value": "5"
    },
    {
        "key": "2",
        "groupOption": false,
        "data": {
            "key": "2",
            "value": "2",
            "children": "Southern"
        },
        "label": "Southern",
        "value": "2"
    },
    {
        "key": "9",
        "groupOption": false,
        "data": {
            "key": "9",
            "value": "9",
            "children": "Uva"
        },
        "label": "Uva",
        "value": "9"
    },
    {
        "key": "1",
        "groupOption": false,
        "data": {
            "key": "1",
            "value": "1",
            "children": "Western"
        },
        "label": "Western",
        "value": "1"
    }
]

*/
/*
 {
    id: 181,
    province: 'WES',
    district: 'WES002',
    city: 'Ganemulla',
    lane: '0',
    longitude: '7.070581',
    latitude: '79.961884',
    phoneNumber: '0',
    shedName: 'K.A.S.B.SIRIWARDENE',
    fuelAvailabilityDTO: {
        id: 71017,
        shedCode: '100220',
        p95Capacity: 0,
        p92Capacity: 0,
        sdCapacity: 0,
        ikCapacity: 0,
        lastUpdateByShed: 1655085824000,
        dcapacity: 0,
        kcapacity: 0,
    },
    instituteId: 181,
    p92Availablity: true,
    p95Availablity: true,
    davailablity: true,
    sdavailablity: true,
    ikavailablity: true,
    kavailablity: true,
    p92Capacity: 0.0,
    p95Capacity: 0.0,
    dcapacity: 0.0,
    sdcapacity: 0.0,
    ikcapacity: 0.0,
    kcapacity: 0.0,
    shedCode: '100220',
};
*/

const Img = styled('img')(({ isDispatched }) => {
    return {
        filter: isDispatched ? 'grayscale(0)' : 'grayscale(1)',
    };
});


/*
{
    bowserDispatch: false
eta: null
fuelCapacity: 435
fuelType: "p92"
lastupdatebyshed: "2022-06-13 07:33"
shedId: 181
shedName: "K.A.S.B.SIRIWARDENE, GANEMULLA"
shedownerupdatetoday: false
}
*/
/**
 * @param {*} props
 * @returns
 */
export default function MarkerCard({ gasStation }) {
    const { id, province, district, city, lane, longitude, latitude } =
        gasStation;
    const provinceCode = getProvinceCode(province);
    const districtCode = getDistrictCode(district);
    const cityCode = getCityCode(city);
    // https://fuel.gov.lk/api/v1/sheddetails/1122
    const {
        isError: isShedError,
        isLoading: isShedLoading,
        data: shedData,
        error: shedError,
    } = useQuery([id], async () => {
        const response = await fetch(`${API_BASE}/sheddetails/${id}`);
        if (!response.ok) {
            throw new Error('Unable to fetch data Check the APIM endpoint');
        }
        return response.json();
    });
    const {
        isError: isP92Error,
        isLoading: isP92Loading,
        data: p92Data,
        error: p92Error,
    } = useQuery(
        ['p92', provinceCode, cityCode, districtCode],
        fetchFuelDetails
    );
    const {
        isError: isDError,
        isLoading: isDLoading,
        data: dData,
        error: dError,
    } = useQuery(
        ['d', provinceCode, cityCode, districtCode],
        fetchFuelDetails
    );

    let thisShedP92;
    if (!isP92Loading && !isP92Error) {
        thisShedP92 = p92Data.find(({ shedId }) => shedId === id);
    }
    let thisShedD;
    if (!isDLoading && !isDError) {
        thisShedD = dData.find(({ shedId }) => shedId === id);
    }
    const {
        phoneNumber,
        shedName,
        fuelAvailabilityDTO,
        instituteId,
        p92Availablity,
        p95Availablity,
        davailablity,
        sdavailablity,
        ikavailablity,
        kavailablity,
        p92Capacity,
        p95Capacity,
        dcapacity,
        sdcapacity,
        ikcapacity,
        kcapacity,
        shedCode,
    } = shedData || {};
    const { lastUpdateByShed } = fuelAvailabilityDTO || {};
    if (isShedError) {
        return (
            <Alert severity="error">
                <AlertTitle>Error</AlertTitle>
                Reason - <strong>{shedError.message}</strong>
            </Alert>
        );
    }
    return (
        <Box
            sx={{
                minWidth: 475,
            }}
        >
            <Box>
                <Typography
                    sx={{
                        fontSize: 14,
                    }}
                    color="textSecondary"
                    gutterBottom
                >
                    Last Updated
                </Typography>
                <Box ml={3}>
                    {!isShedLoading ? (
                        <Typography variant="h6" component="h6">
                            <code>{dayjs().to(dayjs(lastUpdateByShed))}</code>
                        </Typography>
                    ) : (
                        <Skeleton variant="text" width={200} />
                    )}
                </Box>
                <Typography color="textSecondary" gutterBottom>
                    Address
                </Typography>
                <Box ml={3}>
                    {!isShedLoading ? (
                        <Typography variant="h6" component="h6">
                            <code>{shedName}</code>
                        </Typography>
                    ) : (
                        <Skeleton animation="wave" />
                    )}
                </Box>
                <Typography
                    sx={{
                        marginBottom: 12,
                    }}
                    color="textSecondary"
                >
                    Available products
                </Typography>
                <Box ml={3}>
                    <Typography variant="body2" component="p">
                        Petrol
                        {!isP92Loading && thisShedP92 ? (
                            thisShedP92.bowserDispatch ? (
                                <Box ml={3}>
                                    <Img
                                        isDispatched={true}
                                        width={60}
                                        src={inComingLoad}
                                    />
                                    Dispatched : <code>{dayjs().to(dayjs(thisShedP92.eta.split(',')[0]))}</code>
                                     <pre>{thisShedP92.eta.split(',')[1]}</pre>
                                </Box>
                            ) : (
                                <Box display="flex" color="red" mx={3}>
                                    Not Dispatched
                                </Box>
                            )
                        ) : (
                            <Skeleton
                                animation="wave"
                                variant="rectangular"
                                width={20}
                                height={20}
                            />
                        )}
                    </Typography>
                    <Typography variant="body2" component="p">
                        Diesel
                        {!isDLoading && thisShedD ? (
                            thisShedD.bowserDispatch ? (
                                <Box ml={3}>
                                    <Img
                                        isDispatched={true}
                                        width={60}
                                        src={inComingLoad}
                                    />
                                     Dispatched : <code>{dayjs().to(dayjs(thisShedD.eta.split(',')[0]))}</code>
                                     <pre>{thisShedD.eta.split(',')[1]}</pre>
                                </Box>
                            ) : (
                                <Box display="flex" color="red" mx={3}>
                                    Not Dispatched
                                </Box>
                            )
                        ) : (
                            <Skeleton
                                animation="wave"
                                variant="rectangular"
                                width={20}
                                height={20}
                            />
                        )}
                    </Typography>
                </Box>
            </Box>
            <CardActions>
                {!isShedLoading ? (
                    <Link
                        target="_blank"
                        rel="noopener"
                        href={`https://www.google.com/maps/dir/?api=1&travelmode=driving&layer=traffic&destination=${longitude},${latitude}`}
                    >
                        <Button variant="outlined" color="primary" size="small">
                            Directions
                        </Button>
                    </Link>
                ) : (
                    <Skeleton animation="wave" />
                )}
            </CardActions>
        </Box>
    );
}
