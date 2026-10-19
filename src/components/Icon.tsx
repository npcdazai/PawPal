import React from 'react';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Ionicons from '@expo/vector-icons/Ionicons';

export type IconType = 'material' | 'community' | 'ionicons';

interface IconProps {
  name: string;
  size?: number;
  color?: string;
  type?: IconType;
  style?: any;
}

export const Icon: React.FC<IconProps> = ({
  name,
  size = 24,
  color = '#191b21',
  type = 'material',
  style,
}) => {
  if (type === 'community') {
    return <MaterialCommunityIcons name={name as any} size={size} color={color} style={style} />;
  }
  if (type === 'ionicons') {
    return <Ionicons name={name as any} size={size} color={color} style={style} />;
  }
  return <MaterialIcons name={name as any} size={size} color={color} style={style} />;
};

