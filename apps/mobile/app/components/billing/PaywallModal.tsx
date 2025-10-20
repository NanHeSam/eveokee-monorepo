import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { useRevenueCat } from '../../hooks/useRevenueCat';
import { PurchasesPackage } from 'react-native-purchases';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

interface PaywallModalProps {
  visible: boolean;
  onClose: () => void;
  reason?: 'limit_reached' | 'signup_prompt' | 'settings' | null;
}

export function PaywallModal({ visible, onClose, reason }: PaywallModalProps) {
  const { offerings, loading, purchasePackage, restorePurchases } = useRevenueCat();
  const [selectedPackage, setSelectedPackage] = useState<PurchasesPackage | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const insets = useSafeAreaInsets();

  const getReasonTitle = (reason?: string | null) => {
    switch (reason) {
      case 'limit_reached':
        return 'You\'ve reached your limit!';
      case 'signup_prompt':
        return 'Upgrade to Pro';
      case 'settings':
        return 'Manage Subscription';
      default:
        return 'Upgrade to Pro';
    }
  };

  const getReasonDescription = (reason?: string | null) => {
    switch (reason) {
      case 'limit_reached':
        return 'You\'ve used all your free music generations. Upgrade to continue creating music.';
      case 'signup_prompt':
        return 'Unlock unlimited music generations and premium features.';
      case 'settings':
        return 'Choose a plan that works best for you.';
      default:
        return 'Unlock unlimited music generations and premium features.';
    }
  };

  const handlePackageSelect = (pkg: PurchasesPackage) => {
    setSelectedPackage(pkg);
  };

  const handlePurchase = async () => {
    if (!selectedPackage) return;

    setIsProcessing(true);
    
    try {
      const result = await purchasePackage(selectedPackage);
      
      if (result.success) {
        Alert.alert(
          'Success!',
          'Your subscription has been activated. Enjoy your premium features!',
          [{ text: 'OK', onPress: onClose }]
        );
      } else if (result.error !== 'Purchase cancelled') {
        Alert.alert('Error', result.error || 'Failed to complete purchase. Please try again.');
      }
    } catch (error) {
      console.error('Purchase error:', error);
      Alert.alert('Error', 'Failed to initiate purchase. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRestorePurchases = async () => {
    setIsProcessing(true);
    try {
      const result = await restorePurchases();
      if (result.success) {
        Alert.alert('Success', 'Your purchases have been restored!');
      } else {
        Alert.alert('No Purchases Found', 'We couldn\'t find any purchases to restore.');
      }
    } catch (err) {
      console.error('Restore error:', err);
      Alert.alert('Error', 'Failed to restore purchases. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const getPackageFeatures = (pkg: PurchasesPackage) => {
    const features = [];
    const identifier = pkg.identifier.toLowerCase();
    
    if (identifier.includes('weekly')) {
      features.push('25 music generations per week');
    } else if (identifier.includes('monthly')) {
      features.push('90 music generations per month');
    } else if (identifier.includes('annual') || identifier.includes('yearly')) {
      features.push('1000 music generations per year');
    }
    
    features.push('High-quality audio generation');
    features.push('Lyrics synchronization');
    features.push('Priority support');
    features.push('No ads');
    features.push('Premium themes');
    
    return features;
  };

  const getPackageLabel = (pkg: PurchasesPackage) => {
    const identifier = pkg.identifier.toLowerCase();
    if (identifier.includes('weekly')) return 'Weekly Pro';
    if (identifier.includes('monthly')) return 'Monthly Pro';
    if (identifier.includes('annual') || identifier.includes('yearly')) return 'Yearly Pro';
    return 'Pro';
  };

  const getPeriodLabel = (pkg: PurchasesPackage) => {
    const identifier = pkg.identifier.toLowerCase();
    if (identifier.includes('weekly')) return 'week';
    if (identifier.includes('monthly')) return 'month';
    if (identifier.includes('annual') || identifier.includes('yearly')) return 'year';
    return 'period';
  };

  const renderContent = () => (
    <SafeAreaView
      className="flex-1 bg-white"
      style={{ paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 24) }}
    >
      <StatusBar barStyle="dark-content" />
      {/* Header */}
      <View className="flex-row items-center justify-between px-6 pb-4 border-b border-gray-200">
        <View className="flex-1 pr-4">
          <Text className="text-3xl font-bold text-gray-900">
            {getReasonTitle(reason)}
          </Text>
          <Text className="text-base text-gray-600 mt-2">
            {getReasonDescription(reason)}
          </Text>
        </View>
        <TouchableOpacity
          onPress={onClose}
          className="h-10 w-10 rounded-full bg-gray-100 items-center justify-center"
          accessibilityLabel="Close paywall"
        >
          <Text className="text-gray-500 text-2xl">×</Text>
        </TouchableOpacity>
      </View>

      {/* Plans */}
      <ScrollView
        className="flex-1 px-6"
        contentContainerStyle={{ paddingBottom: 32, paddingTop: 24 }}
        showsVerticalScrollIndicator={false}
      >
        {offerings?.availablePackages.map((pkg) => (
          <TouchableOpacity
            key={pkg.identifier}
            onPress={() => handlePackageSelect(pkg)}
            className={`p-5 rounded-2xl border-2 mb-4 shadow-sm ${
              selectedPackage?.identifier === pkg.identifier
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 bg-white'
            }`}
            activeOpacity={0.9}
          >
            <View className="flex-row justify-between items-start">
              <View className="flex-1 pr-4">
                <Text className="text-base font-semibold text-blue-600 uppercase tracking-wide">
                  {getPackageLabel(pkg)}
                </Text>
                <Text className="text-3xl font-bold text-gray-900 mt-1">
                  {pkg.product.priceString}
                  <Text className="text-lg text-gray-500 font-normal">
                    /{getPeriodLabel(pkg)}
                  </Text>
                </Text>
              </View>
              {selectedPackage?.identifier === pkg.identifier && (
                <View className="w-8 h-8 bg-blue-500 rounded-full items-center justify-center">
                  <Text className="text-white text-lg font-bold">✓</Text>
                </View>
              )}
            </View>

            <View className="mt-4">
              {getPackageFeatures(pkg).map((feature, index) => (
                <View key={index} className="flex-row items-center mb-2">
                  <Text className="text-blue-500 text-base mr-2">•</Text>
                  <Text className="text-gray-700 text-sm">{feature}</Text>
                </View>
              ))}
            </View>

            {(pkg.identifier.toLowerCase().includes('annual') || pkg.identifier.toLowerCase().includes('yearly')) && (
              <View className="mt-4 p-3 bg-green-100 rounded-xl">
                <Text className="text-green-800 text-sm font-medium text-center">
                  Best Value — Save 33%
                </Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Purchase Button */}
      <View className="px-6 pt-4 border-t border-gray-200">
        <TouchableOpacity
          onPress={handlePurchase}
          disabled={!selectedPackage || isProcessing}
          className={`py-4 rounded-2xl ${
            selectedPackage && !isProcessing ? 'bg-blue-500' : 'bg-gray-300'
          }`}
          activeOpacity={0.9}
        >
          {isProcessing ? (
            <View className="flex-row items-center justify-center">
              <ActivityIndicator size="small" color="white" />
              <Text className="text-white font-semibold ml-2">Processing...</Text>
            </View>
          ) : (
            <Text className="text-white font-semibold text-center text-lg">
              {selectedPackage ? `Subscribe Now` : 'Select a Plan'}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleRestorePurchases}
          disabled={isProcessing}
          className="py-3 mt-2"
        >
          <Text className="text-center text-sm text-blue-500 font-medium">
            Restore Purchases
          </Text>
        </TouchableOpacity>

        <Text className="text-center text-xs text-gray-500 mt-2">
          Cancel anytime. No commitment required.
        </Text>
      </View>
    </SafeAreaView>
  );

  if (loading) {
    return (
      <Modal
        visible={visible}
        animationType="fade"
        presentationStyle="fullScreen"
        onRequestClose={onClose}
      >
        <SafeAreaView className="flex-1 bg-white items-center justify-center">
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text className="text-center mt-4 text-gray-600">Loading offerings...</Text>
        </SafeAreaView>
      </Modal>
    );
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      {renderContent()}
    </Modal>
  );
}

