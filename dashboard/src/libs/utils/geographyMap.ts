import { provincesMap, districtsMap, citiesMap } from '../../data/geoDataMap';

export const getProvinceCode = (province: string): number | null => {
    return Number(provincesMap.get(province)) || null;
};

export const getDistrictCode = (district: string): number | null => {
    return Number(districtsMap.get(district)) || null;
};
export const getCityCode = (city: string): number => {
    return citiesMap.get(city) || -1;
};
