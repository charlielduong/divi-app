import React, { useEffect, useState } from 'react';
import { Alert, Platform, SafeAreaView, View, useWindowDimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import type { Session } from '@supabase/supabase-js';
import { DesktopSidebar, TabBar, TabName } from './components/navigation';
import { Divi } from './domain/models';
import { CreateDiviScreen } from './screens/CreateDiviScreen';
import { DiviDetailScreen } from './screens/DiviDetailScreen';
import {
  HomeScreen,
  ProfileScreen,
  ReceiptsScreen,
  ComingSoonScreen,
  WelcomeScreen,
} from './screens/HomeScreens';
import { appStyles as styles } from './theme/appStyles';
import { supabase } from '../lib/supabase';
import { signInWithGoogle } from './services/googleAuth';
import {
  deleteDivi as deleteDiviFromDatabase,
  loadUserDivis,
  saveDivi as saveDiviToDatabase,
} from './services/diviRepository';

type Route = { name: 'root' } | { name: 'create'; draft?: Divi } | { name: 'detail'; id: string };

const persistedDiviIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default function DiviApp() {
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= 900;
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabName>('home');
  const [route, setRoute] = useState<Route>({ name: 'root' });
  const [divis, setDivis] = useState<Divi[]>([]);

  useEffect(() => {
    if (!session) {
      setDivis([]);
      return;
    }

    let active = true;
    loadUserDivis(session.user.id)
      .then((saved) => {
        if (active) setDivis(saved);
      })
      .catch((error) => {
        if (active) {
          Alert.alert(
            'Could not load your Divis',
            error instanceof Error ? error.message : 'Please try again.',
          );
        }
      });

    return () => {
      active = false;
    };
  }, [session?.user.id]);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(async ({ data, error }) => {
      if (!mounted) return;
      if (error) setAuthError(error.message);

      let nextSession = data.session;
      if (nextSession) {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError || !userData.user) {
          await supabase.auth.signOut({ scope: 'local' });
          nextSession = null;
        } else {
          nextSession = { ...nextSession, user: userData.user };
        }
      }

      if (!mounted) return;
      setSession(nextSession);
      setAuthLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleGoogleSignIn = async () => {
    setAuthError(null);
    setAuthLoading(true);
    try {
      const nextSession = await signInWithGoogle();
      if (!nextSession) setAuthLoading(false);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Google sign-in failed.');
      setAuthLoading(false);
    }
  };
  const replaceDivi = (next: Divi) =>
    setDivis((items) => {
      const existing = items.some((item) => item.id === next.id);
      return existing ? items.map((item) => (item.id === next.id ? next : item)) : [next, ...items];
    });

  const persistDivi = async (next: Divi, destination: 'detail' | 'root') => {
    const wasPersisted = persistedDiviIdPattern.test(next.id);
    const previousDivis = divis;
    const previousRoute = route;

    // Existing Divis already have stable database IDs, so update the UI and
    // navigate immediately while the multi-step persistence runs in the
    // background. New Divis still wait for the server-generated ID.
    if (wasPersisted) {
      replaceDivi(next);
      if (destination === 'detail') setRoute({ name: 'detail', id: next.id });
      else setRoute({ name: 'root' });
    }

    try {
      const saved = await saveDiviToDatabase(session!.user, next);
      replaceDivi(saved);
      if (!wasPersisted) {
        if (destination === 'detail') setRoute({ name: 'detail', id: saved.id });
        else setRoute({ name: 'root' });
      }
    } catch (error) {
      if (wasPersisted) {
        setDivis(previousDivis);
        setRoute(previousRoute);
      }
      Alert.alert(
        'Could not save your Divi',
        error instanceof Error ? error.message : 'Please try again.',
      );
    }
  };

  const deleteDivi = (id: string) => {
    void deleteDiviFromDatabase(session!.user.id, id)
      .then(() => setDivis((items) => items.filter((item) => item.id !== id)))
      .catch((error) => {
        Alert.alert(
          'Could not delete this Divi',
          error instanceof Error ? error.message : 'Please try again.',
        );
      });
  };

  const saveDivi = (next: Divi) => void persistDivi(next, 'detail');
  const saveProgress = (next: Divi) => void persistDivi(next, 'root');
  const refreshDivis = async () => {
    if (!session) return;
    try {
      const saved = await loadUserDivis(session.user.id);
      setDivis(saved);
    } catch (error) {
      Alert.alert(
        'Could not refresh your Divis',
        error instanceof Error ? error.message : 'Please try again.',
      );
    }
  };
  const openDivi = (id: string) => {
    const divi = divis.find((item) => item.id === id);
    if (divi?.state === 'draft') setRoute({ name: 'create', draft: divi });
    else setRoute({ name: 'detail', id });
  };

  if (authLoading && !session)
    return <WelcomeScreen onGoogleSignIn={handleGoogleSignIn} isLoading error={authError} />;
  if (!session)
    return (
      <WelcomeScreen onGoogleSignIn={handleGoogleSignIn} isLoading={false} error={authError} />
    );
  if (route.name === 'create')
    return (
      <CreateDiviScreen
        initialDraft={route.draft}
        onClose={() => setRoute({ name: 'root' })}
        onCreate={saveDivi}
        onSave={saveProgress}
      />
    );
  if (route.name === 'detail') {
    const divi = divis.find((item) => item.id === route.id);
    if (divi)
      return (
        <DiviDetailScreen
          divi={divi}
          onBack={() => setRoute({ name: 'root' })}
          onAdjust={() => setRoute({ name: 'create', draft: divi })}
          onSave={saveProgress}
          onFinalize={saveDivi}
        />
      );
  }
  return (
    <View style={styles.appRoot}>
      {tab === 'home' && !isDesktop && (
        <LinearGradient
          pointerEvents="none"
          colors={['#FAFBF9', 'rgba(250,251,249,0.8)', 'rgba(250,251,249,0)']}
          locations={[0, 0.62, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.homeTopBackdrop}
        />
      )}
      <SafeAreaView
        style={[
          styles.safe,
          isDesktop && styles.desktopSafe,
          tab === 'home' && styles.homeSafe,
          tab === 'receipts' && styles.receiptsSafe,
          tab === 'profile' && styles.profileSafe,
        ]}
      >
        <StatusBar style="dark" />
        <View style={[styles.app, isDesktop && styles.desktopApp]}>
          {isDesktop && (
            <DesktopSidebar
              selected={tab}
              onSelect={setTab}
              onCreate={() => setRoute({ name: 'create' })}
            />
          )}
          <View style={[styles.desktopMain, !isDesktop && styles.flex]}>
            {tab === 'home' && (
              <HomeScreen
                divis={divis}
                onContinue={openDivi}
                onAdjust={(id) => {
                  const divi = divis.find((item) => item.id === id);
                  if (divi) setRoute({ name: 'create', draft: divi });
                }}
                onDelete={deleteDivi}
                onRefresh={refreshDivis}
                isDesktop={isDesktop}
              />
            )}
            {tab === 'receipts' && (
              <ReceiptsScreen
                divis={divis}
                userId={session.user.id}
                onOpen={openDivi}
                onAdjust={(id) => {
                  const divi = divis.find((item) => item.id === id);
                  if (divi) setRoute({ name: 'create', draft: divi });
                }}
                onDelete={deleteDivi}
                onRefresh={refreshDivis}
                isDesktop={isDesktop}
              />
            )}
            {tab === 'activity' && (
              <ComingSoonScreen />
            )}
            {tab === 'profile' && (
              <ProfileScreen
                user={session.user}
                divis={divis}
                onOpen={openDivi}
                onAdjust={(id) => {
                  const divi = divis.find((item) => item.id === id);
                  if (divi) setRoute({ name: 'create', draft: divi });
                }}
                onDelete={deleteDivi}
                onRefresh={refreshDivis}
                onUpdateName={async (name) => {
                  const { error } = await supabase.auth.updateUser({
                    data: { full_name: name, name },
                  });
                  if (error) throw new Error(error.message);
                }}
                onSignOut={() => {
                  void supabase.auth.signOut();
                }}
                isDesktop={isDesktop}
              />
            )}
            {!isDesktop && (
              <TabBar
                selected={tab}
                onSelect={setTab}
                onCreate={() => setRoute({ name: 'create' })}
              />
            )}
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}
