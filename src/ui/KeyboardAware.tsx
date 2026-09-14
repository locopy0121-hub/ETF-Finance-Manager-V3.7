import React from 'react';
import {KeyboardAvoidingView,Platform,ScrollView,StyleSheet,type ScrollViewProps,type ViewStyle} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

export function KeyboardAwareScrollView({children,contentContainerStyle,keyboardVerticalOffset=0,...props}:ScrollViewProps&{keyboardVerticalOffset?:number}){const insets=useSafeAreaInsets();return <KeyboardAvoidingView style={s.flex} behavior={Platform.OS==='ios'?'padding':'height'} keyboardVerticalOffset={keyboardVerticalOffset}><ScrollView {...props} automaticallyAdjustKeyboardInsets keyboardDismissMode={Platform.OS==='ios'?'interactive':'on-drag'} keyboardShouldPersistTaps="handled" contentContainerStyle={[{paddingBottom:Math.max(24,insets.bottom)+96},contentContainerStyle]}>{children}</ScrollView></KeyboardAvoidingView>}
export function KeyboardSafeFooter({children,style}:{children:React.ReactNode;style?:ViewStyle}){const insets=useSafeAreaInsets();return <KeyboardAvoidingView behavior={Platform.OS==='ios'?'position':'height'} keyboardVerticalOffset={0} style={[{paddingBottom:Math.max(12,insets.bottom)},style]}>{children}</KeyboardAvoidingView>}
const s=StyleSheet.create({flex:{flex:1}});
