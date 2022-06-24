export const API_BASE = 'https://apis.knnect.com/api/v1';

export const fetchFuelDetails = async ({ queryKey }: any) => {
    const [fuelType, provinceCode, cityCode, districtCode] = queryKey;
    const payload: any = {
        province: provinceCode,
        district: districtCode,
        fuelType,
    };
    if (cityCode !== -1) {
        payload.city = cityCode;
    }
    const response = await fetch(`${API_BASE}/sheddetails/search`, {
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        method: 'POST',
    });

    if (!response.ok) {
        throw new Error('Unable to fetch data Check the APIM endpoint');
    }
    return response.json();
};

export default fetchFuelDetails;