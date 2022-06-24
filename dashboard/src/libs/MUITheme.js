export const themeOptions = {
    palette: {
        type: "light",
        primary: {
            main: "#0096e6"
        },
        secondary: {
            main: "#00796b"
        },
        background: {
            default: "#f6fbff"
        }
    },
    spacing: 8,
    overrides: {
        MuiSwitch: {
            root: {
                width: 42,
                height: 26,
                padding: 0,
                margin: 8
            },
            switchBase: {
                padding: 1,
                "&$checked, &$colorPrimary$checked, &$colorSecondary$checked": {
                    transform: "translateX(16px)",
                    color: "#fff",
                    "& + $track": {
                        opacity: 1,
                        border: "none"
                    }
                }
            },
            thumb: {
                width: 24,
                height: 24
            },
            track: {
                borderRadius: 13,
                border: "1px solid #bdbdbd",
                backgroundColor: "#fafafa",
                opacity: 1,
                transition: "background-color 300ms cubic-bezier(0.4, 0, 0.2, 1) 0ms,border 300ms cubic-bezier(0.4, 0, 0.2, 1) 0ms"
            }
        }
    },
    props: {
        MuiButtonBase: {
            disableRipple: true
        },
        MuiButton: {
            size: "small"
        },
        MuiButtonGroup: {
            size: "small"
        },
        MuiCheckbox: {
            size: "small"
        },
        MuiFab: {
            size: "small"
        },
        MuiFormControl: {
            margin: "dense",
            size: "small"
        },
        MuiFormHelperText: {
            margin: "dense"
        },
        MuiIconButton: {
            size: "small"
        },
        MuiInputBase: {
            margin: "dense"
        },
        MuiInputLabel: {
            margin: "dense"
        },
        MuiRadio: {
            size: "small"
        },
        MuiSwitch: {
            size: "small"
        },
        MuiTextField: {
            margin: "dense",
            size: "small"
        },
        MuiTooltip: {
            arrow: true
        }
    }
};

export default themeOptions;