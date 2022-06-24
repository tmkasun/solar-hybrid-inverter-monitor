import React from 'react';
import TextField from '@mui/material/TextField';
import Autocomplete from '@mui/material/Autocomplete';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import Grid from '@mui/material/Grid';
import Box from '@mui/material/Box';
import throttle from 'lodash.throttle';
import LinearProgress from '@mui/material/LinearProgress';
import { Typography } from '@mui/material';

export default function PlaceSelector(props) {
    const { onValueChange } = props;
    const [value, setValue] = React.useState(null);
    const [inputValue, setInputValue] = React.useState('');
    const [isLoading, setIsLoading] = React.useState(false);
    const [options, setOptions] = React.useState([]);

    React.useEffect(() => {
        onValueChange(value)
    }, [value])
    const fetchX = React.useMemo(
        () =>
            throttle((inputValue, callback) => {
                setIsLoading(true);
                // fetch(`https://api.opencagedata.com/geocode/v1/json?q=${inputValue}&key=47a4473508fc49518ad05cb0d84f94b8&countrycode=lk`)
                fetch(`https://api.opencagedata.com/geosearch?q=${inputValue}&limit=5&language=en&countrycode=lk`, { headers: { 'opencage-geosearch-key': 'oc_gs_SJqvrAWtCs2mcAvMs5f9yPs6LI1QcD' } })
                    .then(r => r.json()).then(callback)
            }, 200),
        [],
    );

    React.useEffect(() => {
        if (inputValue === '') {
            setOptions(value ? [value] : []);
            return undefined;
        }
        if (inputValue.length > 1) {
            fetchX(inputValue, (results) => {
                let newOptions = [];

                if (value) {
                    newOptions = [value];
                }

                if (results) {
                    newOptions = results.results;
                }

                setOptions(newOptions);
                setIsLoading(false);
            });
        }

    }, [value, inputValue, fetchX]);

    return (
        <Autocomplete
            id="klocation"
            style={{ width: '100%' }}
            getOptionLabel={(option) => option.formatted}
            filterOptions={(x) => x}
            options={options}
            autoComplete
            autoHighlight
            includeInputInList
            filterSelectedOptions
            value={value}
            onChange={(event, newValue) => {
                setOptions(newValue ? [newValue, ...options] : options);
                setValue(newValue);
            }}
            onInputChange={(event, newInputValue) => {
                setInputValue(newInputValue);
            }}
            renderInput={(params) => (
                <TextField {...params} label="Location (i:e Ganemulla, Moratuwa ... )" variant="outlined" fullWidth />
            )}
            loading={isLoading}
            renderOption={(props, option) => {
                return (
                    <Grid  {...props} container alignItems="center">
                        <Grid item>
                            <LocationOnIcon
                                sx={(theme) => ({
                                    color: theme.palette.text.secondary,
                                    marginRight: theme.spacing(2),
                                })}
                            />
                        </Grid>
                        <Grid item xs>
                            <Typography variant='body'>
                                {option.formatted}
                            </Typography>
                        </Grid>
                    </Grid>
                );
            }}
        />
    );
}