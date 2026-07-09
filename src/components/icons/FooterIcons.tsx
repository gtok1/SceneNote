import type { SvgProps } from "react-native-svg";
import Svg, { Circle, G, Path } from "react-native-svg";

export type FooterIconProps = SvgProps & {
  active?: boolean;
  className?: string;
  color?: string;
  size?: number;
};

function iconProps({ color = "currentColor", size = 24, ...props }: FooterIconProps) {
  return {
    ...props,
    accessibilityElementsHidden: true,
    color,
    focusable: false,
    height: size,
    viewBox: "0 0 24 24",
    width: size
  } as const;
}

export function HomeTheaterIcon(props: FooterIconProps) {
  const { active = false, color = "currentColor" } = props;

  return (
    <Svg fill="none" {...iconProps(props)}>
      {active ? <Path d="M5 8.5h14v8.2H5z" fill={color} opacity={0.14} /> : null}
      <Path d="M5 8.5h14v8.2H5z" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
      <Path d="M10 12l3.8 2.2L10 16.4z" fill={active ? color : "none"} stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} />
      <Path d="M8.2 19h7.6M9 6l3-2 3 2M7 20.5h10" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
      <Path d="M8 18.2c.6-.9 1.6-1.4 3-1.4h2c1.4 0 2.4.5 3 1.4" stroke={color} strokeLinecap="round" strokeWidth={2} />
    </Svg>
  );
}

export function CompassIcon(props: FooterIconProps) {
  const { active = false, color = "currentColor" } = props;

  return (
    <Svg fill="none" {...iconProps(props)}>
      <Circle cx={12} cy={12} r={8.5} fill={active ? color : "none"} opacity={active ? 0.12 : 1} stroke={color} strokeWidth={2} />
      <Path d="M15.8 8.2l-2 5.6-5.6 2 2-5.6z" fill={active ? color : "none"} stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
      <Circle cx={12} cy={12} r={0.9} fill={color} />
    </Svg>
  );
}

export function ArchiveBoxIcon(props: FooterIconProps) {
  const { active = false, color = "currentColor" } = props;

  return (
    <Svg fill="none" {...iconProps(props)}>
      <Path d="M5 8.5h14v10.2a1.8 1.8 0 0 1-1.8 1.8H6.8A1.8 1.8 0 0 1 5 18.7z" fill={active ? color : "none"} opacity={active ? 0.14 : 1} stroke={color} strokeLinejoin="round" strokeWidth={2} />
      <Path d="M4.2 5.7c0-.9.7-1.7 1.7-1.7h12.2c1 0 1.7.8 1.7 1.7v2.8H4.2zM9.5 12h5" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
    </Svg>
  );
}

export function PinQuoteIcon(props: FooterIconProps) {
  const { active = false, color = "currentColor" } = props;

  return (
    <Svg fill="none" {...iconProps(props)}>
      <Path d="M12 21s6.2-5.8 6.2-11a6.2 6.2 0 1 0-12.4 0C5.8 15.2 12 21 12 21z" fill={active ? color : "none"} opacity={active ? 0.16 : 1} stroke={color} strokeLinejoin="round" strokeWidth={2} />
      <Path d="M9.2 10.5c0-1.1.6-1.8 1.5-2.2M9.2 10.5h1.7v2H9.2zM13.2 10.5c0-1.1.6-1.8 1.5-2.2M13.2 10.5h1.7v2h-1.7z" stroke={active ? "#FFFFFF" : color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} />
    </Svg>
  );
}

export function PersonChatIcon(props: FooterIconProps) {
  const { active = false, color = "currentColor" } = props;

  return (
    <Svg fill="none" {...iconProps(props)}>
      <Circle cx={9.2} cy={9} r={3.1} fill={active ? color : "none"} opacity={active ? 0.14 : 1} stroke={color} strokeWidth={2} />
      <Path d="M3.8 19c.9-3 2.8-4.5 5.4-4.5 2 0 3.6.8 4.6 2.3" stroke={color} strokeLinecap="round" strokeWidth={2} />
      <Path d="M14.2 5.5h4.1c1.2 0 2.1.9 2.1 2.1v3.1c0 1.2-.9 2.1-2.1 2.1h-1.5l-2.3 2v-2h-.3c-1.2 0-2.1-.9-2.1-2.1V7.6c0-1.2.9-2.1 2.1-2.1z" fill={active ? color : "none"} opacity={active ? 0.12 : 1} stroke={color} strokeLinejoin="round" strokeWidth={2} />
      <Path d="M15.1 9.1h2.6" stroke={active ? "#FFFFFF" : color} strokeLinecap="round" strokeWidth={1.6} />
    </Svg>
  );
}

export function UserSettingsIcon(props: FooterIconProps) {
  const { active = false, color = "currentColor" } = props;

  return (
    <Svg fill="none" {...iconProps(props)}>
      <Circle cx={9.3} cy={8.6} r={3.2} fill={active ? color : "none"} opacity={active ? 0.14 : 1} stroke={color} strokeWidth={2} />
      <Path d="M3.8 18.9c.9-3.1 2.8-4.7 5.5-4.7 1.7 0 3 .6 4 1.7" stroke={color} strokeLinecap="round" strokeWidth={2} />
      <G stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}>
        <Path d="M17.4 12.7v1.1M17.4 19.2v1.1M14.1 16.5H13M21.8 16.5h-1.1M15.1 14.2l-.8-.8M20.5 19.6l-.8-.8M15.1 18.8l-.8.8M20.5 13.4l-.8.8" />
        <Circle cx={17.4} cy={16.5} r={2.1} fill={active ? color : "none"} opacity={active ? 0.14 : 1} />
      </G>
    </Svg>
  );
}
