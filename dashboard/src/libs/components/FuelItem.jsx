import { Typography } from '@mui/material';
import Box from '@mui/material/Box';
import AvailabilityIcon from './AvailabilityIcon';

export default function FuelItem({ fuelName, isAvailable }) {
  return (
    <Box display='flex' alignItems='center'>
      <Typography variant='body2' component='p' style={{ marginRight: 10 }}>
        {fuelName}
      </Typography>
      <AvailabilityIcon isAvailable={isAvailable} />
    </Box>
  );
}
