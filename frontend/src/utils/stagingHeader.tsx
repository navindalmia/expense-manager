import React from 'react';
import { Text } from 'react-native';
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { isStaging } from './appVariant';
import { STAGING_ORANGE } from '../components/StagingBanner';

type HeaderTitleProps = { children: string; tintColor?: string };

function StagingHeaderTitle({ children, tintColor }: HeaderTitleProps): React.ReactElement {
  return (
    <Text numberOfLines={1} style={{ color: tintColor ?? '#FFFFFF', fontSize: 17, fontWeight: '600' }}>
      {`${children}  •  STAGING`}
    </Text>
  );
}

/**
 * Staging marker for every screen that has a native header: an orange header with a STAGING tag
 * in the title. It lives inside the header, so it adds no wrapper and cannot change screen layout.
 * Returns an empty object in production, so the production navigator options are unchanged.
 */
export function getStagingScreenOptions(): NativeStackNavigationOptions {
  if (!isStaging()) return {};
  return {
    headerStyle: { backgroundColor: STAGING_ORANGE },
    headerTintColor: '#FFFFFF',
    headerTitle: StagingHeaderTitle,
  };
}
