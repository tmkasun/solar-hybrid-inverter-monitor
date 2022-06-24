import React, { useState } from "react";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

// Original design here: https://github.com/siriwatknp/mui-treasury/issues/540

import { deepPurple } from "@mui/material/colors";

const MinimalSelect = (props) => {
  const { lastXDays, setLastXDays } = props;

  const handleChange = (event) => {
    setLastXDays(event.target.value);
  };

  const iconComponent = (props) => {
    return (
      <ExpandMoreIcon
        sx={{
          color: deepPurple[300],
          right: 12,
          position: "absolute",
          userSelect: "none",
          pointerEvents: "none"
        }}
      />
    );
  };

  // moves the menu below the select input
  const menuProps = {
    sx: {
      ...{
        borderRadius: 12,
        marginTop: 8
      }, ...{
        paddingTop: 0,
        paddingBottom: 0,
        background: "white",
        "& li": {
          fontWeight: 200,
          paddingTop: 12,
          paddingBottom: 12
        },
        "& li:hover": {
          background: deepPurple[100]
        },
        "& li.Mui-selected": {
          color: "white",
          background: deepPurple[400]
        },
        "& li.Mui-selected:hover": {
          background: deepPurple[500]
        }
      }
    },
    anchorOrigin: {
      vertical: "bottom",
      horizontal: "left"
    },
    transformOrigin: {
      vertical: "top",
      horizontal: "left"
    },
    getContentAnchorEl: null
  };

  return (
    <FormControl>
      <Select
        disableUnderline
        sx={{
          minWidth: 200,
          background: "white",
          color: deepPurple[500],
          fontWeight: 200,
          borderStyle: "none",
          borderWidth: 2,
          borderRadius: 12,
          paddingLeft: 24,
          paddingTop: 14,
          paddingBottom: 15,
          boxShadow: "0px 5px 8px -3px rgba(0,0,0,0.14)",
          "&:focus": {
            borderRadius: 12,
            background: "white",
            borderColor: deepPurple[100]
          }
        }}
        MenuProps={menuProps}
        IconComponent={iconComponent}
        value={lastXDays}
        onChange={handleChange}
      >
        <MenuItem value={0}>All Time</MenuItem>
        <MenuItem value={30}>Last Month</MenuItem>
        <MenuItem value={7}>Last Week</MenuItem>
      </Select>
    </FormControl>
  );
};

export default MinimalSelect;
