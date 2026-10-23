<script setup lang="ts">
const route = useRoute();
await navigateTo(
  `/app/companies/${route.params.companyId}/venues/${route.params.venueId}/schedule`,
  { redirectCode: 302 },
);

defineOptions({ name: "TeamScheduleRedirect" });
</script>
