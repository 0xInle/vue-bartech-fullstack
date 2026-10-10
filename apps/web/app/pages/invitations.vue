<template>
  <InvitationAcceptanceScreen />
</template>

<script setup lang="ts">
import InvitationAcceptanceScreen from "~/features/invitations/components/InvitationAcceptanceScreen.vue";

defineOptions({ name: "InvitationAcceptancePage" });
useHead({ meta: [{ name: "referrer", content: "no-referrer" }] });
</script>
