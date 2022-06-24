import React from "react";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import FormControlLabel from "@mui/material/FormControlLabel";
import Box from '@mui/material/Box';
import FormControl from "@mui/material/FormControl";

import StyledSelect from "../StyledSelect";


const DataController = (props) => {
    const {
        dataType,
        setDataType,
        lastXDays,
        setLastXDays,
    } = props;
    return (
        <Box borderColor="grey.500" border={1} borderRadius={16}>
            <FormControl component="fieldset">
                <RadioGroup
                    row
                    aria-label="position"
                    name="position"
                    onChange={(e) => {
                        setDataType(e.currentTarget.value);
                    }}
                    value={dataType}
                    defaultValue="total"
                >
                    <FormControlLabel
                        value="total"
                        control={<Radio color="secondary" />}
                        label="Total"
                        labelPlacement="top"
                    />
                    <FormControlLabel
                        value="Dose1"
                        control={<Radio color="secondary" />}
                        label={
                            <>
                                1<sup>st</sup> Dose
                            </>
                        }
                        labelPlacement="top"
                    />
                    <FormControlLabel
                        value="dose2"
                        control={<Radio color="secondary" />}
                        label={
                            <>
                                2<sup>nd</sup> Dose
                            </>
                        }
                        labelPlacement="top"
                    />
                </RadioGroup>
            </FormControl>
            <StyledSelect lastXDays={lastXDays} setLastXDays={setLastXDays} />
        </Box>
    )
}


export default DataController