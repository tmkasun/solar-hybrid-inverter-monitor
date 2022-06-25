const root = {
    fontColor: '#222',
    bgColor: '#f2f3f7',
    buttonBgColor: '#f2f3f7',
    buttonShadow:
        '-6px -6px 8px rgba(255, 255, 255, 0.9),5px 5px 8px rgba(0, 0, 0, 0.07)',
};

export const buttonStyles = {
    '.button': {
        color: root.fontColor,
        position: 'relative',
        borderRadius: '15px',
        background: root.buttonBgColor,
        fontWeight: 700,
        transition: 'all 100ms cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        boxShadow: root.buttonShadow,
        cursor: 'pointer',
        '&.button-link': {
            color: '#067CF8',
            display: 'block',
            fontSize: '17px',
            margin: '30px 0 0',
            padding: '20px 0',
            width: '100%',
        },
        '&.button-small': {
            color: '#6D6E74',
            fontSize: '22px',
            lineHeight: '40px',
            width: '40px',
            height: '40px',
        },
        '&.button-large': {
            display: 'flex',
            fontSize: '20px',
            flexDirection: 'column',
            padding: '15px',
            textAlign: 'left',
            width: '45%',
            '& svg': { marginBottom: '40px', width: '30px' },
        },
    },
};


export const spokeColors = {
    ".button-dial-spoke": {
      backgroundColor: "rgba(96, 171, 254, 0.6)",
      display: "block",
      height: "2px",
      width: "83%",
      position: "absolute",
      margin: "0 auto",
      zIndex: 5,
      top: "50%",
      "&:nth-child(2)": { transform: "rotate(30deg)" },
      "&:nth-child(3)": { transform: "rotate(60deg)" },
      "&:nth-child(4)": { transform: "rotate(90deg)" },
      "&:nth-child(5)": { transform: "rotate(120deg)" },
      "&:nth-child(6)": { transform: "rotate(150deg)" }
    }
  }
  
  export const dialTopStyles = {
    ".button-dial-top": {
      background: root.buttonBgColor,
      boxShadow: root.buttonShadow,
      borderRadius: "50%",
      width: "70%",
      height: "70%",
      margin: "0 auto",
      position: "absolute",
      top: "15%",
      left: "15%",
      textAlign: "center",
      zIndex: 5
    }
  }
  
  export const dialLabelStyles = {
    ".button-dial-label": {
      color: "#067CF8",
      fontSize: "28px",
      fill: "#067CF8",
      position: "relative",
      zIndex: 10
    }
  }
  