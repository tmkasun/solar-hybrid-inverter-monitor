import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import CancelRoundedIcon from '@mui/icons-material/CancelRounded';

export default function AvailabilityIcon({ isAvailable }) {
  return isAvailable ? (
    <CheckCircleRoundedIcon color='success' />
  ) : (
    <CancelRoundedIcon color='error' />
  );
}
