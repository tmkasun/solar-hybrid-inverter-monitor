import { styled } from '@mui/system';
import React from 'react';
import './temp.css';
import {
    buttonStyles,
    dialLabelStyles,
    dialTopStyles,
    spokeColors,
} from './TemperatureGauge.styles';
// const DialButton = styled('div')({
//     borderRadius: '50%',
//     display: 'flex',
//     height: '270px',
//     margin: '35px auto',
//     alignItems: 'center',
//     justifyContent: 'center',
//     width: '270px',
//     ...buttonStyles,
// });

// const DialSpoke = styled('div')(spokeColors);
// const DialTop = styled('div')(dialTopStyles);
// const DialLabel = styled('div')(dialLabelStyles);

function TemperatureGauge({ name, value }: any) {
    const specialProps = {
        'xmlns:xlink': 'http://www.w3.org/1999/xlink',
        'xml:space': 'preserve',
    };
    return (
        <div className="button button-dial">
            <span className="button-dial-spoke"></span>
            <span className="button-dial-spoke"></span>
            <span className="button-dial-spoke"></span>
            <span className="button-dial-spoke"></span>
            <span className="button-dial-spoke"></span>
            <span className="button-dial-spoke"></span>

            <div className="button-dial-top"></div>
            <div className="button-dial-label">
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    version="1.1"
                    x="0px"
                    y="0px"
                    viewBox="0 0 100 125"
                    enable-background="new 0 0 100 100"
                    {...specialProps}
                >
                    <g>
                        <path d="M60.333,68.349V11.111C60.333,4.984,55.349,0,49.222,0c-6.126,0-11.111,4.984-11.111,11.111v57.237   c-4.15,3.323-6.667,8.397-6.667,13.874c0,9.802,7.975,17.777,17.777,17.777C59.024,100,67,92.024,67,82.223   C67,76.746,64.482,71.672,60.333,68.349z M44.778,48.363h4.444v-4.444h-4.444V35.03h4.444v-4.444h-4.444v-8.889h4.444v-4.444   h-4.444v-6.142c0-2.455,1.99-4.444,4.444-4.444c2.455,0,4.445,1.989,4.445,4.444v41.111h-8.889V48.363z" />
                    </g>
                </svg>
                {value / 10}&deg;C
            </div>
        </div>
    );
}

export default TemperatureGauge;
