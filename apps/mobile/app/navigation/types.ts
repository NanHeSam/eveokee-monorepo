import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { Id } from 'convex-backend';

export type DiaryStackParamList = {
  DiaryHome: undefined;
  DiaryEdit: {
    diaryId?: Id<'diaries'>;
    content?: string;
    title?: string;
  } | undefined;
};

export type DiaryStackNavigationProp = NativeStackNavigationProp<DiaryStackParamList, 'DiaryHome'>;

export type DiaryEditNavigationProp = NativeStackNavigationProp<DiaryStackParamList, 'DiaryEdit'>;

export type DiaryEditRouteProp = RouteProp<DiaryStackParamList, 'DiaryEdit'>;

