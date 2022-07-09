import * as React from 'react';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import Select, { SelectChangeEvent } from '@mui/material/Select';
import { useMutation } from 'react-query';
import { API_BASE_PATH } from './consts';
import { Alert, Button, Skeleton, Snackbar } from '@mui/material';
import Box from '@mui/system/Box';

export default function ChargingMode() {
    const [mode, setMode] = React.useState('');
    const mutation = useMutation<any, any, string>(async (newMode) => {
        const response = await fetch(`${API_BASE_PATH}/device/mode/charging`, {
            headers: {
                'Content-Type': 'application/json',
            },
            method: 'POST',
            body: JSON.stringify({ mode: newMode }),
        });
        if (!response.ok) {
            throw new Error('Unable to change Inverter Mode');
        }
        const data = await response.json();
        if(data.accept) {
            return data;
        } else {
            throw new Error('Server has rejected the change');
        }
    });
    const handleChange = (event: SelectChangeEvent) => {
        const { value } = event.target;
        mutation.mutate(value);
        setMode(value);
    };
    if (mutation.error) {
        return (
            <Box
                display="flex"
                flexDirection="row"
                justifyContent="center"
                alignItems="center"
            >
                <Box>
                    <Alert severity="error">{mutation.error.message}</Alert>
                </Box>
                <Box>
                    <Button onClick={mutation.reset}>reset</Button>
                </Box>
            </Box>
        );
    }
    return mutation.isLoading ? (
        <Skeleton variant="rectangular" width="90px" height="25px" />
    ) : (
        <>
            <FormControl
                disabled={mutation.isLoading}
                sx={{ m: 1, minWidth: 120 }}
                size="small"
            >
                <InputLabel id="inverter-charging-mode-label">Mode</InputLabel>
                <Select
                    labelId="inverter-charging-mode-label"
                    id="inverter-charging-mode"
                    value={mode}
                    label="Mode"
                    onChange={handleChange}
                >
                    <MenuItem value={'SO'}>Solar Only</MenuItem>
                    <MenuItem value={'SF'}>Solar First</MenuItem>
                    <MenuItem value={'SU'}>Solar & Utility</MenuItem>
                </Select>
            </FormControl>
            <Snackbar
                open={mutation.isSuccess}
                autoHideDuration={6000}
                onClose={mutation.reset}
                message="Charging Mode Updated"
            />
        </>
    );
}
