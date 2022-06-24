import React from 'react'
import Chip from '@mui/material/Chip';
import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';

import dayjs from "dayjs";
var relativeTime = require("dayjs/plugin/relativeTime");
dayjs.extend(relativeTime, { rounding: Math.floor });


const LastUpdated = (props) => {
    const { time: lastUpdated, isUnix = false, isLoading = false } = props;
    const d = isUnix ? dayjs.unix(lastUpdated) : dayjs(lastUpdated)
    return (
        <Box my={0.5} mr={1} justifyContent="flex-end" display='flex' fontWeight="fontWeightMedium">
            Last updated: <Tooltip title={(lastUpdated && d.toString()) || ''}>
                <Chip style={{marginLeft: '4px'}} variant="outlined" label={isLoading ? 'Loading' : lastUpdated && dayjs().to(d)} color="primary" size="small" />
            </Tooltip>
        </Box>
    );
}

export default LastUpdated;