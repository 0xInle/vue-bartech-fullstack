<template>
  <section>
    <CompanyCreationForm
      :company-name="companyName"
      :venue-name="venueName"
      :initial-role="initialRole"
      :busy="busy"
      :disabled="disabled"
      @update:company-name="$emit('update:companyName', $event)"
      @update:venue-name="$emit('update:venueName', $event)"
      @update:initial-role="$emit('update:initialRole', $event)"
      @submit="$emit('submit')"
      @cancel="$emit('cancel')"
    />
  </section>
</template>

<script setup lang="ts">
import CompanyCreationForm from "~/features/organizations/components/CompanyCreationForm.vue";

type InitialRole = "CHEF_BARTENDER" | "BAR_MANAGER" | "SENIOR_BARTENDER" | "BARTENDER";

defineProps<{
  companyName: string;
  venueName: string;
  initialRole: InitialRole | "";
  busy: boolean;
  disabled: boolean;
}>();

defineEmits<{
  "update:companyName": [value: string];
  "update:venueName": [value: string];
  "update:initialRole": [value: InitialRole];
  submit: [];
  cancel: [];
}>();
</script>
