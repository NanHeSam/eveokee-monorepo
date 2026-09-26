import React from 'react';
import { Text, View } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import {
  createNavigationContainerRef,
  createNavigatorFactory,
  NavigationContainer,
  StackRouter,
  TabRouter,
  useNavigationBuilder,
  type ParamListBase,
} from '@react-navigation/native';
import { EventDetailsScreen } from '../EventDetailsScreen';
import { SignUpScreen } from '../SignUpScreen';

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('react-native-safe-area-context', () => {
  const actual = jest.requireActual('react-native-safe-area-context');
  return {
    ...actual,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
    SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
  };
});
jest.mock('convex/react', () => {
  const event = {
    diaryId: 'diary-1',
    title: 'A day to remember',
    summary: 'A walk with a friend',
    happenedAt: 1750000000000,
    mood: 1,
    arousal: 3,
    tags: [],
    people: [],
  };
  return { useQuery: () => event, useMutation: () => jest.fn() };
});
jest.mock('@backend/convex', () => ({
  api: { events: { getEvent: 'events:getEvent', updateEvent: 'events:updateEvent' } },
}));
jest.mock('@clerk/expo', () => ({
  useSSO: () => ({ startSSOFlow: jest.fn() }),
  useClerk: () => ({ setActive: jest.fn() }),
}));
jest.mock('@clerk/expo/legacy', () => ({
  useSignUp: () => ({ isLoaded: true, signUp: {}, setActive: jest.fn() }),
}));
jest.mock('expo-auth-session', () => ({ makeRedirectUri: () => 'eveokee://oauth-native-callback' }));
jest.mock('expo-web-browser', () => ({ maybeCompleteAuthSession: jest.fn() }));
jest.mock('../../hooks/useAuthSetup', () => ({
  useAuthSetup: () => ({ ensureConvexUser: jest.fn() }),
}));
jest.mock('../../components/auth/SocialAuthButtons', () => ({ SocialAuthButtons: () => null }));

// Exercise the real navigation container and routers without native screen animations.
function TestStackNavigator(props: any) {
  const { state, descriptors, NavigationContent } = useNavigationBuilder(StackRouter, props);
  return <NavigationContent>{descriptors[state.routes[state.index].key].render()}</NavigationContent>;
}

function TestTabNavigator(props: any) {
  const { state, descriptors, NavigationContent } = useNavigationBuilder(TabRouter, props);
  return (
    <NavigationContent>
      {state.routes.map((route, index) => (
        <View key={route.key} style={{ display: index === state.index ? 'flex' : 'none' }}>
          {descriptors[route.key].render()}
        </View>
      ))}
    </NavigationContent>
  );
}

const Stack = createNavigatorFactory(TestStackNavigator)();
const Tabs = createNavigatorFactory(TestTabNavigator)();
const Placeholder = () => <Text>Screen placeholder</Text>;
const DiaryView = () => <Text>Full diary entry</Text>;
const SignIn = () => <Text>Sign in screen</Text>;

function DiaryNavigator() {
  return (
    <Stack.Navigator id="DiaryStack">
      <Stack.Screen name="DiaryHome" component={Placeholder} />
      <Stack.Screen name="DiaryView" component={DiaryView} />
      <Stack.Screen name="EventDetails" component={EventDetailsScreen} />
    </Stack.Navigator>
  );
}

function SettingsNavigator() {
  return (
    <Stack.Navigator id="SettingsStack">
      <Stack.Screen name="SettingsHome" component={Placeholder} />
      <Stack.Screen name="People" component={Placeholder} />
      <Stack.Screen name="PersonDetail" component={Placeholder} />
      <Stack.Screen name="EventDetails" component={EventDetailsScreen} />
    </Stack.Navigator>
  );
}

describe('React Navigation 7 screen transitions', () => {
  it.each([
    { scenario: 'opens a new entry', diaryState: undefined },
    {
      scenario: 'returns to an existing entry without duplicating it',
      diaryState: {
        index: 2,
        routes: [
          { name: 'DiaryHome' },
          { name: 'DiaryView', params: { diaryId: 'diary-1' } },
          { name: 'EventDetails', params: { eventId: 'event-1' } },
        ],
      },
    },
  ])('$scenario from an event in the Settings stack', async ({ diaryState }) => {
    const navigation = createNavigationContainerRef<ParamListBase>();
    await render(
      <NavigationContainer
        ref={navigation}
        initialState={{
          index: 1,
          routes: [
            { name: 'Diary', state: diaryState },
            {
              name: 'Settings',
              state: {
                index: 3,
                routes: [
                  { name: 'SettingsHome' },
                  { name: 'People' },
                  { name: 'PersonDetail', params: { personId: 'person-1' } },
                  { name: 'EventDetails', params: { eventId: 'event-1' } },
                ],
              },
            },
          ],
        }}
      >
        <Tabs.Navigator id="MainTabs">
          <Tabs.Screen name="Diary" component={DiaryNavigator} />
          <Tabs.Screen name="Settings" component={SettingsNavigator} />
        </Tabs.Navigator>
      </NavigationContainer>,
    );

    await fireEvent.press(screen.getByText('View Full Entry'));

    expect(screen.getByText('Full diary entry')).toBeOnTheScreen();
    const state = navigation.getRootState();
    expect(state.routes[state.index].name).toBe('Diary');
    expect(navigation.getCurrentRoute()).toMatchObject({
      name: 'DiaryView',
      params: { diaryId: 'diary-1' },
    });
    const diary = state.routes.find(route => route.name === 'Diary');
    expect(diary.state.routes.map(route => route.name)).toEqual(['DiaryHome', 'DiaryView']);
    const settings = state.routes.find(route => route.name === 'Settings');
    expect(settings.state.routes.map(route => route.name)).toEqual([
      'SettingsHome', 'People', 'PersonDetail', 'EventDetails',
    ]);
  });

  it.each([
    {
      scenario: 'returns to an existing entry without duplicating it',
      routes: [
        { name: 'DiaryHome' },
        { name: 'DiaryView', params: { diaryId: 'diary-1' } },
        { name: 'EventDetails', params: { eventId: 'event-1' } },
      ],
      expectedRoutes: ['DiaryHome', 'DiaryView'],
      backTo: 'DiaryHome',
    },
    {
      scenario: 'opens a new entry without removing the event from history',
      routes: [
        { name: 'DiaryHome' },
        { name: 'EventDetails', params: { eventId: 'event-1' } },
      ],
      expectedRoutes: ['DiaryHome', 'EventDetails', 'DiaryView'],
      backTo: 'EventDetails',
    },
  ])('$scenario in the Diary stack', async ({ routes, expectedRoutes, backTo }) => {
    const navigation = createNavigationContainerRef<ParamListBase>();
    await render(
      <NavigationContainer
        ref={navigation}
        initialState={{ index: routes.length - 1, routes }}
      >
        <DiaryNavigator />
      </NavigationContainer>,
    );

    await fireEvent.press(screen.getByText('View Full Entry'));

    expect(screen.getByText('Full diary entry')).toBeOnTheScreen();
    expect(navigation.getRootState().routes.map(route => route.name)).toEqual(expectedRoutes);
    expect(navigation.getCurrentRoute().params).toEqual({ diaryId: 'diary-1' });
    await act(async () => navigation.goBack());
    expect(navigation.getCurrentRoute().name).toBe(backTo);
  });

  it.each([
    ['returning from sign in', [{ name: 'SignIn' }, { name: 'SignUp' }]],
    ['opening sign up directly', [{ name: 'SignUp' }]],
  ])('leaves one SignIn screen when %s', async (_scenario, routes) => {
    const navigation = createNavigationContainerRef<ParamListBase>();
    await render(
      <NavigationContainer ref={navigation} initialState={{ index: routes.length - 1, routes }}>
        <Stack.Navigator id="RootStack">
          <Stack.Screen name="SignIn" component={SignIn} />
          <Stack.Screen name="SignUp" component={SignUpScreen} />
        </Stack.Navigator>
      </NavigationContainer>,
    );

    await fireEvent.press(screen.getByText('Sign in'));

    expect(screen.getByText('Sign in screen')).toBeOnTheScreen();
    expect(navigation.getRootState().routes.map(route => route.name)).toEqual(['SignIn']);
    expect(navigation.canGoBack()).toBe(false);
  });
});
