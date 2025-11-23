import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp, NavigatorScreenParams, CompositeNavigationProp } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { Id } from '@backend/convex/convex/_generated/dataModel';

export type DiaryStackParamList = {
  DiaryHome: undefined;
  DiaryView: {
    diaryId: Id<'diaries'>;
  };
  DiaryEdit: {
    diaryId?: Id<'diaries'>;
    content?: string;
    title?: string;
  } | undefined;
  EventDetails: {
    eventId: Id<'events'>;
  };
  PersonDetail: {
    personId: Id<'people'>;
  };
};

export type SettingsStackParamList = {
  SettingsHome: undefined;
  Account: undefined;
};

export type MainTabsParamList = {
  Diary: NavigatorScreenParams<DiaryStackParamList>;
  Playlist: undefined;
  Settings: NavigatorScreenParams<SettingsStackParamList>;
};

export type RootStackParamList = {
  SignIn: undefined;
  SignUp: undefined;
  MainTabs: NavigatorScreenParams<MainTabsParamList>;
};

// Navigation props for nested navigation from tab screens
export type PlaylistTabNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabsParamList, 'Playlist'>,
  NativeStackNavigationProp<RootStackParamList>
>;

export type DiaryStackNavigationProp = NativeStackNavigationProp<DiaryStackParamList, 'DiaryHome'>;

export type DiaryEditNavigationProp = NativeStackNavigationProp<DiaryStackParamList, 'DiaryEdit'>;

export type DiaryEditRouteProp = RouteProp<DiaryStackParamList, 'DiaryEdit'>;

export type DiaryViewNavigationProp = NativeStackNavigationProp<DiaryStackParamList, 'DiaryView'>;

export type DiaryViewRouteProp = RouteProp<DiaryStackParamList, 'DiaryView'>;

export type EventDetailsNavigationProp = NativeStackNavigationProp<DiaryStackParamList, 'EventDetails'>;

export type EventDetailsRouteProp = RouteProp<DiaryStackParamList, 'EventDetails'>;

export type PersonDetailNavigationProp = NativeStackNavigationProp<DiaryStackParamList, 'PersonDetail'>;

export type PersonDetailRouteProp = RouteProp<DiaryStackParamList, 'PersonDetail'>;
